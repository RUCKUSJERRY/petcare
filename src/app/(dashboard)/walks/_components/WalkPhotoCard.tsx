'use client'

import { useRef, useState } from 'react'
import { validateImage } from '@/lib/upload'
import { formatDistance, formatDuration, formatPace } from '@/lib/utils'

/**
 * 산책 사진에 기록(거리·시간·페이스·날짜)을 오버랩한 공유용 이미지 카드를 만든다.
 * (Nike Run Club의 사진 공유 카드 벤치마킹) — 캔버스로 합성 후 저장/공유.
 */
export function WalkPhotoCard({
  distanceM,
  durationS,
  dateLabel,
}: {
  distanceM: number
  durationS: number
  dateLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  const compose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) { setError(invalid); return }
    setBusy(true); setError(null)
    try {
      const bitmap = await createImageBitmap(file)
      // 긴 변 1080 기준으로 축소
      const maxDim = 1080
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')
      ctx.drawImage(bitmap, 0, 0, w, h)

      // 하단 그라데이션
      const gradH = Math.round(h * 0.42)
      const grad = ctx.createLinearGradient(0, h - gradH, 0, h)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.72)')
      ctx.fillStyle = grad
      ctx.fillRect(0, h - gradH, w, gradH)

      const pad = Math.round(w * 0.055)
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 6

      // 거리 (대표 수치)
      const big = Math.round(w * 0.135)
      ctx.font = `800 ${big}px system-ui, -apple-system, sans-serif`
      ctx.fillText(formatDistance(distanceM), pad, h - pad - Math.round(big * 1.15))

      // 시간 · 페이스
      const mid = Math.round(w * 0.05)
      ctx.font = `600 ${mid}px system-ui, -apple-system, sans-serif`
      ctx.fillText(`${formatDuration(durationS)}  ·  ${formatPace(distanceM, durationS)}`, pad, h - pad - Math.round(big * 0.35))

      // 날짜 + 브랜드
      const small = Math.round(w * 0.036)
      ctx.font = `500 ${small}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(`🐾 펫케어 · ${dateLabel}`, pad, h - pad)

      const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error('blob fail')
      blobRef.current = blob
      if (imgUrl) URL.revokeObjectURL(imgUrl)
      setImgUrl(URL.createObjectURL(blob))
    } catch {
      setError('이미지를 만들지 못했어요. 다른 사진으로 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = `petcare-walk-${Date.now()}.jpg`
    a.click()
  }

  const share = async () => {
    const blob = blobRef.current
    if (!blob) return
    const file = new File([blob], 'walk.jpg', { type: 'image/jpeg' })
    const navAny = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
    if (navAny.share && navAny.canShare?.({ files: [file] })) {
      try {
        await navAny.share({ files: [file], title: '오늘의 산책' })
        return
      } catch { /* 취소/실패 → 다운로드 폴백 */ }
    }
    download()
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-600 text-sm font-medium disabled:opacity-60"
      >
        {busy ? '만드는 중…' : '📸 사진에 기록 입혀 공유 카드 만들기'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={compose} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {imgUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="산책 기록 카드" className="w-full rounded-xl border border-gray-100" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={download} className="btn-secondary py-2 text-sm">저장</button>
            <button onClick={share} className="btn-primary py-2 text-sm">공유</button>
          </div>
        </div>
      )}
    </div>
  )
}

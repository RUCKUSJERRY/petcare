'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, deleteImageByUrl, validateImage } from '@/lib/upload'
import { formatDistance, formatDuration, formatPace } from '@/lib/utils'
import { useTranslations } from 'next-intl'

/**
 * 산책 종료 화면: 사진을 촬영/선택하면 기록(거리·시간·페이스·날짜)을 오버랩한
 * 합성 이미지를 즉시 미리보기로 보여주고, 그 합성 이미지를 Storage에 업로드한다.
 * 업로드된 URL을 onChange로 올려주면 산책 저장 시 photo_url로 함께 저장된다.
 * (Nike Run Club식 사진 공유 카드 — 합성 결과를 그대로 기록으로 보관)
 */
export function WalkPhotoComposer({
  distanceM,
  durationS,
  dateLabel,
  value,
  onChange,
  onError,
}: {
  distanceM: number
  durationS: number
  dateLabel: string
  value: string | null
  onChange: (url: string | null) => void
  onError?: (msg: string | null) => void
}) {
  const t = useTranslations('walkPhoto')
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  // 이 컴포넌트에서 업로드(아직 미저장)한 URL들. 교체/제거 시 즉시 정리한다.
  const sessionUrls = useRef<Set<string>>(new Set())

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) { onError?.(invalid); return }
    setBusy(true); onError?.(null)
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
      ctx.fillText(t('cardBrand', { date: dateLabel }), pad, h - pad)

      const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92))
      if (!blob) throw new Error('blob fail')

      // 합성 이미지를 Storage에 업로드 (기록과 함께 보관)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      const composed = new File([blob], `walk-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url = await uploadImage('pet-photos', composed, user.id)

      // 이전에 이 세션에서 올린 미저장 합성본이 있으면 정리(고아 방지)
      if (value && sessionUrls.current.has(value)) {
        deleteImageByUrl(value)
        sessionUrls.current.delete(value)
      }
      sessionUrls.current.add(url)
      onChange(url)
    } catch {
      onError?.(t('composeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (value && sessionUrls.current.has(value)) {
      deleteImageByUrl(value)
      sessionUrls.current.delete(value)
    }
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-600 text-sm font-medium disabled:opacity-60"
      >
        {busy ? t('composing') : value ? t('retake') : t('makeCard')}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      {value && (
        <div className="space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={t('cardAlt')} className="w-full rounded-xl border border-gray-100" />
          <button type="button" onClick={remove} className="text-xs text-gray-400 hover:text-red-500">
            {t('remove')}
          </button>
        </div>
      )}
    </div>
  )
}

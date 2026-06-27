'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * 산책 상세 페이지: 이미 기록이 합성되어 저장된 사진(imageUrl)을
 * 기기에 저장(다운로드)하거나 외부 앱으로 공유한다. (재합성하지 않음)
 */
export function WalkPhotoCard({ imageUrl }: { imageUrl: string }) {
  const t = useTranslations('walkPhoto')
  const tc = useTranslations('common')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBlob = async () => {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error('fetch failed')
    return res.blob()
  }

  const download = async () => {
    setBusy(true); setError(null)
    try {
      const blob = await fetchBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `petcare-walk-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('composeFailed'))
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    setBusy(true); setError(null)
    try {
      const blob = await fetchBlob()
      const file = new File([blob], 'walk.jpg', { type: blob.type || 'image/jpeg' })
      const navAny = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
      if (navAny.share && navAny.canShare?.({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: t('shareTitle') })
          return
        } catch { /* 취소/실패 → 다운로드 폴백 */ }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `petcare-walk-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('composeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={download} disabled={busy} className="btn-secondary py-2 text-sm disabled:opacity-60">{tc('save')}</button>
        <button onClick={share} disabled={busy} className="btn-primary py-2 text-sm disabled:opacity-60">{t('share')}</button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

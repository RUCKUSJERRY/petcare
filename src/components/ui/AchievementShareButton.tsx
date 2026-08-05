'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { achievementCaption } from '@/lib/achievement'
import { shareOrDownloadImage } from '@/lib/shareImage'

/**
 * 성취(연속 기록·이정표)를 브랜드 이미지 카드로 만들어 공유하는 버튼.
 * - 클릭 시 1080×1080 캔버스에 성취를 그려 Web Share API(navigator.share, 파일)로 공유한다.
 * - 파일 공유를 지원하지 않는 환경(데스크톱 등)에서는 이미지를 다운로드로 폴백한다.
 * - 정적 이미지라 업로드 없이 즉석 생성한다. (WalkPhotoComposer 의 캔버스 합성 패턴 재사용)
 */
export function AchievementShareButton({
  icon,
  headline,
  petName,
  className = '',
}: {
  icon: string
  headline: string
  petName: string
  className?: string
}) {
  const t = useTranslations('ui')
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      const size = 1080
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')

      // 배경: 브랜드 그라데이션
      const grad = ctx.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, '#2d8a42')
      grad.addColorStop(1, '#1f6e32')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 대표 이모지
      ctx.font = '300px system-ui, -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.fillText(icon, size / 2, size * 0.34)

      // 성취 문구
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 84px system-ui, -apple-system, sans-serif'
      ctx.fillText(headline, size / 2, size * 0.6)

      // 아이 이름
      if (petName.trim()) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = '500 52px system-ui, -apple-system, sans-serif'
        ctx.fillText(petName.trim(), size / 2, size * 0.7)
      }

      // 브랜드 푸터
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '600 40px system-ui, -apple-system, sans-serif'
      ctx.fillText('🐾 펫케어', size / 2, size * 0.9)

      const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('blob fail')

      await shareOrDownloadImage(blob, 'petcare-achievement.png', achievementCaption(petName, headline))
    } catch {
      // 캔버스/공유 실패 — 조용히 무시(비핵심 기능)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      aria-label={t('achievementShareAria')}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors disabled:opacity-60 ${className}`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a2 2 0 100-4 2 2 0 000 4zM6 14a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
      {t('share')}
    </button>
  )
}

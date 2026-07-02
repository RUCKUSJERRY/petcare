'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

/**
 * 링크 공유 버튼.
 * - 모바일 등 navigator.share 지원 시 네이티브 공유 시트를 띄운다.
 * - 미지원 시 클립보드에 링크를 복사하고 "복사됨" 피드백을 보여준다.
 *
 * path: 공유할 앱 내 경로(예: "/walks/123"). 절대 URL은 현재 origin으로 구성한다.
 */
export function ShareButton({
  path,
  title,
  text,
  label,
  className,
  iconOnly = false,
}: {
  path: string
  title: string
  text?: string
  label?: string
  className?: string
  iconOnly?: boolean
}) {
  const t = useTranslations('ui')
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shareLabel = label ?? t('share')

  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current) }, [])

  const share = async () => {
    const url = typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path
    // navigator.share는 보안 컨텍스트(https)에서만 동작
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // 사용자가 취소했거나 실패 → 복사 폴백으로 진행
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // 클립보드도 막힌 환경: 프롬프트로 링크 노출
      window.prompt(t('shareCopyPrompt'), url)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={shareLabel}
      className={
        className ??
        'flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors'
      }
    >
      {copied ? (
        iconOnly ? <span aria-hidden>✓</span> : <>{t('shareCopied')}</>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {!iconOnly && shareLabel}
        </>
      )}
    </button>
  )
}

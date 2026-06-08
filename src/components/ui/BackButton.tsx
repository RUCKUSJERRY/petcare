'use client'

import { useRouter } from 'next/navigation'

export function BackButton({
  className = 'text-gray-400',
  fallbackHref,
}: {
  className?: string
  fallbackHref?: string
}) {
  const router = useRouter()

  const handleBack = () => {
    // 직접 진입 등으로 히스토리가 없으면 fallback 경로로 이동
    if (fallbackHref && typeof window !== 'undefined' && window.history.length <= 1) {
      router.push(fallbackHref)
    } else {
      router.back()
    }
  }

  return (
    <button onClick={handleBack} className={className} aria-label="뒤로">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

'use client'

import { useRouter } from 'next/navigation'

export function BackButton({ className = 'text-gray-400' }: { className?: string }) {
  const router = useRouter()
  return (
    <button onClick={() => router.back()} className={className} aria-label="뒤로">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

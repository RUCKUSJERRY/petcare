'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * 커뮤니티 제목 검색바. 제출 시 현재 필터(baseParams)에 q를 합쳐 이동한다.
 */
export function SearchBar({
  initialQuery,
  baseParams,
}: {
  initialQuery: string
  baseParams: Record<string, string>
}) {
  const t = useTranslations('community')
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)

  const go = (query: string) => {
    const p = new URLSearchParams(baseParams)
    const trimmed = query.trim()
    if (trimmed) p.set('q', trimmed)
    else p.delete('q')
    p.delete('page') // 검색 시 1페이지로
    const qs = p.toString()
    router.push(qs ? `/community?${qs}` : '/community')
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    go(q)
  }

  return (
    <form onSubmit={submit} className="relative">
      <input
        className="input pr-9"
        placeholder={t('searchPlaceholder')}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {q ? (
        <button
          type="button"
          onClick={() => { setQ(''); go('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={t('searchClear')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={t('search')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
        </button>
      )}
    </form>
  )
}

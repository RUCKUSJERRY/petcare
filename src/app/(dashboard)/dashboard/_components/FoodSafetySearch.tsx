'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

/**
 * 홈 '음식 안전 빠른검색'.
 *
 * "우리 애 이거 먹어도 돼?"는 반려인이 가장 자주·불안하게 찾는 질의인데, 예전엔 더보기 → 음식 →
 * 안전 탭까지 최소 두세 번 눌러야 닿아 앱의 킬러 정보 기능이 깊이 묻혀 있었다. 홈에서 바로 음식
 * 이름을 입력해 안전도 검색 결과(/foods)로 딥링크한다(가장 잦은 의도를 최상위로 → 재방문·체류).
 */
export function FoodSafetySearch() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [q, setQ] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    // 검색어가 비어도 음식 안전 화면(검색 탭)을 바로 연다 — 진입 자체가 목적이므로 막지 않는다.
    router.push(`/foods?view=safety${query ? `&q=${encodeURIComponent(query)}` : ''}`)
  }

  return (
    <form onSubmit={submit} className="card space-y-2">
      <label htmlFor="food-safety-q" className="text-sm font-semibold text-gray-700">
        {t('foodSearchTitle')}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          <input
            id="food-safety-q"
            className="input pl-9"
            placeholder={t('foodSearchPlaceholder')}
            aria-label={t('foodSearchTitle')}
            value={q}
            onChange={e => setQ(e.target.value)}
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className="btn-primary px-4 text-sm font-semibold shrink-0">
          {t('foodSearchCta')}
        </button>
      </div>
    </form>
  )
}

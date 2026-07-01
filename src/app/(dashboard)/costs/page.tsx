'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { cn, formatWon, careCategoryIcon } from '@/lib/utils'
import { aggregateCostStats, costYears, type CostRecord } from '@/lib/costStats'

export default function CostsPage() {
  const t = useTranslations('costs')
  const supabase = createClient()
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const { data: myPets } = useMyPets()
  const [year, setYear] = useState<number | null>(null)

  // 비용이 입력된 기록만 (RLS가 내가 구성원인 아이만 반환)
  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['cost-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('records')
        .select('pet_id, category, event_on, cost')
        .not('cost', 'is', null)
        .gt('cost', 0)
        .order('event_on', { ascending: false })
      // 에러를 던져 isError로 표면화 — 네트워크 실패가 "기록 없음"으로 오인되지 않도록.
      if (error) throw error
      return (data ?? []) as (CostRecord & { pet_id: string })[]
    },
  })

  // 선택된 아이로 필터 (없으면 전체)
  const scoped = useMemo(
    () => (selectedPetId ? records.filter(r => r.pet_id === selectedPetId) : records),
    [records, selectedPetId]
  )

  const years = useMemo(() => costYears(scoped), [scoped])
  const activeYear = year != null && years.includes(year) ? year : years[0]
  const stats = useMemo(() => aggregateCostStats(scoped, activeYear), [scoped, activeYear])
  const monthsWithSpend = stats.byMonth.filter(m => m.total > 0).length
  const avgPerMonth = monthsWithSpend ? Math.round(stats.total / monthsWithSpend) : 0

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('title')} fallbackHref="/dashboard" />

      {/* 아이 선택 */}
      {myPets && myPets.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
          <button
            onClick={() => setSelectedPetId(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border shrink-0 transition-colors',
              !selectedPetId ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
            )}
          >
            {t('allPets')}
          </button>
          {myPets.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPetId(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border shrink-0 transition-colors',
                selectedPetId === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
              )}
            >
              {p.species === 'cat' ? '🐱' : '🐶'} {p.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : isError ? (
        <EmptyState variant="error" title={t('loadError')} />
      ) : scoped.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={t('empty')}
          hint={t('emptyHint')}
          action={
            <Link href="/schedule?add=1" className="inline-block text-sm text-primary-600 font-semibold">
              {t('goRecord')}
            </Link>
          }
        />
      ) : (
        <>
          {/* 연도 선택 */}
          {years.length > 1 && (
            <div className="flex gap-1.5">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                    y === activeYear ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200'
                  )}
                >
                  {t('yearLabel', { year: y })}
                </button>
              ))}
            </div>
          )}

          {/* 총 지출 요약 */}
          <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <p className="text-xs text-white/80 font-medium">{t('yearLabel', { year: activeYear })} {t('total')}</p>
            <p className="text-2xl font-bold mt-0.5">{formatWon(stats.total)}</p>
            <p className="text-xs text-white/80 mt-1">
              {t('count', { n: stats.count })}
              {avgPerMonth > 0 && <> · {t('avgPerMonth')} {formatWon(avgPerMonth)}</>}
            </p>
          </div>

          {/* 월별 지출 */}
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-gray-500">{t('monthly')}</p>
            <div className="flex items-end justify-between gap-1 h-28">
              {stats.byMonth.map(m => {
                const pct = stats.maxMonthTotal ? Math.round((m.total / stats.maxMonthTotal) * 100) : 0
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className={cn('w-full rounded-md', m.total > 0 ? 'bg-primary-400' : 'bg-gray-100')}
                      style={{ height: `${Math.max(pct, m.total > 0 ? 6 : 2)}%` }}
                      title={m.total > 0 ? formatWon(m.total) : ''}
                    />
                    <span className="text-[9px] text-gray-400">{m.month}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 항목별 지출 */}
          <div className="card space-y-2.5">
            <p className="text-sm font-semibold text-gray-500">{t('byCategory')}</p>
            {stats.byCategory.map(c => {
              const pct = stats.total ? Math.round((c.total / stats.total) * 100) : 0
              return (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                      <span aria-hidden>{careCategoryIcon(c.category)}</span>
                      {c.category}
                      <span className="text-xs text-gray-400">· {t('count', { n: c.count })}</span>
                    </span>
                    <span className="font-semibold text-gray-900">{formatWon(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">{t('disclaimer')}</p>
        </>
      )}
    </div>
  )
}

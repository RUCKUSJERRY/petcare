'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { cn, formatWon, careCategoryIcon } from '@/lib/utils'
import { aggregateCostStats, costYears, type CostRecord } from '@/lib/costStats'
import { RecordDetailModal } from '../pets/_components/RecordDetailModal'

// 드릴다운 목록에 쓰기 위해 id·title 까지 포함한 비용 기록
type CostRow = CostRecord & { pet_id: string; id: string; title: string }
type Drill = { kind: 'month'; month: number } | { kind: 'category'; category: string }

export default function CostsPage() {
  const t = useTranslations('costs')
  const supabase = createClient()
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const { data: myPets } = useMyPets()
  const [year, setYear] = useState<number | null>(null)
  // '전체 아이' 보기는 전역 선택(useSelectedPet)을 지우지 않고 이 화면 안에서만 처리한다.
  // (예전엔 setSelectedPetId(null)로 전역을 비워, 홈 복귀 시 요약 카드·인라인 기록이 사라지던 문제)
  const [showAll, setShowAll] = useState(false)
  const effectivePetId = showAll ? null : selectedPetId
  // 월/항목 막대를 누르면 해당 내역을 아래에 펼친다 (탭하면 상세/수정 모달)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // 비용이 입력된 기록만 (RLS가 내가 구성원인 아이만 반환)
  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['cost-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('records')
        .select('id, pet_id, category, title, event_on, cost')
        .not('cost', 'is', null)
        .gt('cost', 0)
        .order('event_on', { ascending: false })
      // 에러를 던져 isError로 표면화 — 네트워크 실패가 "기록 없음"으로 오인되지 않도록.
      if (error) throw error
      return (data ?? []) as CostRow[]
    },
  })

  // 선택된 아이로 필터 (없으면 전체)
  const scoped = useMemo(
    () => (effectivePetId ? records.filter(r => r.pet_id === effectivePetId) : records),
    [records, effectivePetId]
  )

  const years = useMemo(() => costYears(scoped), [scoped])
  const activeYear = year != null && years.includes(year) ? year : years[0]
  const stats = useMemo(() => aggregateCostStats(scoped, activeYear), [scoped, activeYear])
  const monthsWithSpend = stats.byMonth.filter(m => m.total > 0).length
  const avgPerMonth = monthsWithSpend ? Math.round(stats.total / monthsWithSpend) : 0

  // 펼친 막대(월/항목)에 해당하는 실제 기록 목록 (해당 연도 기준, 최신순)
  const drillRecords = useMemo(() => {
    if (!drill) return []
    return scoped.filter(r => {
      if (!r.cost || r.cost <= 0 || r.event_on.slice(0, 4) !== String(activeYear)) return false
      return drill.kind === 'month'
        ? Number(r.event_on.slice(5, 7)) === drill.month
        : r.category === drill.category
    })
  }, [scoped, drill, activeYear])

  // 아이/연도를 바꾸면 펼친 내역은 접는다 (엉뚱한 스코프의 목록이 남지 않도록)
  const scopeKey = `${effectivePetId ?? 'all'}-${activeYear}`
  const prevScope = useRef(scopeKey)
  if (prevScope.current !== scopeKey) { prevScope.current = scopeKey; if (drill) setDrill(null) }

  const drillKey = (d: Drill) => (d.kind === 'month' ? `m${d.month}` : `c${d.category}`)
  const toggleDrill = (d: Drill) => setDrill(cur => (cur && drillKey(cur) === drillKey(d) ? null : d))

  return (
    <div className="px-4 py-6 space-y-4">
      {/* 데이터가 있어도 이 화면에서 바로 비용을 기록할 수 있도록 상단에 추가 진입점을 둔다.
          (예전엔 빈 상태에만 링크가 있어, 기록이 쌓이면 비용을 더하려 다른 화면으로 나가야 했다.) */}
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        <Link
          href="/schedule?add=1"
          className="shrink-0 flex items-center gap-1 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold px-3 py-1.5 hover:bg-primary-100 transition-colors"
        >
          <span aria-hidden>＋</span> {t('addRecord')}
        </Link>
      </div>

      {/* 아이 선택 */}
      {myPets && myPets.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
          <button
            onClick={() => setShowAll(true)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border shrink-0 transition-colors',
              !effectivePetId ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
            )}
          >
            {t('allPets')}
          </button>
          {myPets.map(p => (
            <button
              key={p.id}
              onClick={() => { setShowAll(false); setSelectedPetId(p.id) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border shrink-0 transition-colors',
                effectivePetId === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
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

          {/* 월별 지출 — 막대를 누르면 그 달 내역을 펼친다(모바일에선 hover 툴팁이 안 보이므로 탭으로) */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-500">{t('monthly')}</p>
              <p className="text-[11px] text-gray-400">{t('monthlyHint')}</p>
            </div>
            <div className="flex items-end justify-between gap-1 h-28">
              {stats.byMonth.map(m => {
                const pct = stats.maxMonthTotal ? Math.round((m.total / stats.maxMonthTotal) * 100) : 0
                const active = drill?.kind === 'month' && drill.month === m.month
                const disabled = m.total === 0
                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => toggleDrill({ kind: 'month', month: m.month })}
                    disabled={disabled}
                    aria-pressed={active}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end disabled:cursor-default group"
                  >
                    <div
                      className={cn('w-full rounded-md transition-colors',
                        m.total === 0 ? 'bg-gray-100'
                          : active ? 'bg-primary-600' : 'bg-primary-400 group-hover:bg-primary-500')}
                      style={{ height: `${Math.max(pct, m.total > 0 ? 6 : 2)}%` }}
                    />
                    <span className={cn('text-[9px]', active ? 'text-primary-600 font-bold' : 'text-gray-400')}>{m.month}</span>
                  </button>
                )
              })}
            </div>
            {drill?.kind === 'month' && (
              <DrillList
                title={t('drillMonth', { n: drill.month })}
                total={drillRecords.reduce((s, r) => s + (r.cost ?? 0), 0)}
                rows={drillRecords}
                emptyText={t('drillEmpty')}
                onPick={setDetailId}
              />
            )}
          </div>

          {/* 항목별 지출 — 행을 누르면 그 항목 내역을 펼친다 */}
          <div className="card space-y-2.5">
            <p className="text-sm font-semibold text-gray-500">{t('byCategory')}</p>
            {stats.byCategory.map(c => {
              const pct = stats.total ? Math.round((c.total / stats.total) * 100) : 0
              const active = drill?.kind === 'category' && drill.category === c.category
              return (
                <div key={c.category} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleDrill({ kind: 'category', category: c.category })}
                    aria-pressed={active}
                    className="w-full flex items-center justify-between text-sm text-left"
                  >
                    <span className={cn('flex items-center gap-1.5 font-medium', active ? 'text-primary-700' : 'text-gray-700')}>
                      <span aria-hidden>{careCategoryIcon(c.category)}</span>
                      {c.category}
                      <span className="text-xs text-gray-400">· {t('count', { n: c.count })}</span>
                    </span>
                    <span className={cn('font-semibold', active ? 'text-primary-700' : 'text-gray-900')}>{formatWon(c.total)}</span>
                  </button>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-colors', active ? 'bg-primary-600' : 'bg-primary-400')} style={{ width: `${pct}%` }} />
                  </div>
                  {active && (
                    <DrillList
                      title={t('drillCategory', { category: c.category })}
                      total={c.total}
                      rows={drillRecords}
                      emptyText={t('drillEmpty')}
                      onPick={setDetailId}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">{t('disclaimer')}</p>
        </>
      )}

      {detailId && (
        <RecordDetailModal recordId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

/** 월/항목을 펼쳤을 때 그 안의 실제 비용 기록 목록 (탭하면 상세/수정) */
function DrillList({
  title, total, rows, emptyText, onPick,
}: {
  title: string
  total: number
  rows: CostRow[]
  emptyText: string
  onPick: (id: string) => void
}) {
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-2 space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-gray-500">{title}</span>
        <span className="text-xs font-bold text-gray-700">{formatWon(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-2 text-xs text-gray-400">{emptyText}</p>
      ) : (
        rows.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            className="w-full flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-left hover:bg-primary-50 transition-colors"
          >
            <span className="text-base shrink-0" aria-hidden>{careCategoryIcon(r.category)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-gray-800 truncate">{r.title || r.category}</span>
              <span className="block text-[11px] text-gray-400">{r.event_on.replace(/-/g, '.')}</span>
            </span>
            <span className="text-sm font-semibold text-gray-900 shrink-0">{formatWon(r.cost ?? 0)}</span>
          </button>
        ))
      )}
    </div>
  )
}

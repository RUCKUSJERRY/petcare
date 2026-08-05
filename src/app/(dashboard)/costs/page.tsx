'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetScopeToggle } from '@/components/ui/PetScopeToggle'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { cn, formatWon, careCategoryIcon, todayKST } from '@/lib/utils'
import { aggregateCostStats, costYears, type CostRecord } from '@/lib/costStats'
import type { RecordCategory } from '@/types'
import { RecordDetailModal } from '../pets/_components/RecordDetailModal'
import { RecordFormModal } from '../pets/_components/RecordFormModal'
import { QuickCostModal } from './_components/QuickCostModal'

// 드릴다운 목록에 쓰기 위해 id·title 까지 포함한 비용 기록
type CostRow = CostRecord & { pet_id: string; id: string; title: string }
type Drill = { kind: 'month'; month: number } | { kind: 'category'; category: string }

export default function CostsPage() {
  const t = useTranslations('costs')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const { selectedPetId } = useSelectedPet()
  const { data: myPets } = useMyPets()
  const [year, setYear] = useState<number | null>(null)
  // 비용 추가 — 기본은 '금액+항목+날짜'만의 빠른 입력(quick), 장소·메모·사진·반복이 필요하면
  // '자세히 입력'으로 전체 폼(detail)으로 전환한다. 예전엔 곧바로 전체 폼만 열려 마찰이 컸다.
  const [addMode, setAddMode] = useState<null | 'quick' | 'detail'>(null)
  // 빠른입력에서 '자세히 입력'으로 넘어올 때 이미 고른 금액·항목·날짜를 이어받아 전체 폼에 프리필한다.
  const [detailDraft, setDetailDraft] = useState<{ amount: string; category: RecordCategory; date: string } | null>(null)
  // 보기 범위: 기본은 헤더에서 고른 아이(selectedPetId). 여러 아이를 키우면 '전체'로 전환해
  // 모든 아이 합산을 볼 수 있다(헤더 선택은 건드리지 않고 이 화면 안에서만 범위를 바꾼다).
  const [showAll, setShowAll] = useState(false)
  const activePet = selectedPetId ? (myPets ?? []).find(p => p.id === selectedPetId) : null
  const multiPet = (myPets?.length ?? 0) >= 2
  const effectivePetId = showAll ? null : selectedPetId
  // 월/항목 막대를 누르면 해당 내역을 아래에 펼친다 (탭하면 상세/수정 모달)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  // 저장 후 모달이 조용히 닫히면 저장됐는지 확신이 안 든다 — 짧은 완료 토스트로 확인시킨다.
  const [justSaved, setJustSaved] = useState(false)
  const showSavedToast = () => { setJustSaved(true); setTimeout(() => setJustSaved(false), 2000) }

  // 비용이 입력된 기록만 (RLS가 내가 구성원인 아이만 반환)
  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['cost-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('records')
        .select('id, pet_id, category, title, event_on, cost')
        .not('cost', 'is', null)
        .gt('cost', 0)
        // 미래로 입력된(예정) 지출은 집계에서 제외 — 주간 리포트와 동일 기준(정합성)
        .lte('event_on', todayKST())
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
      {/* 아이 범위는 헤더 칩으로 통일 — 여기선 현재 기준 라벨 + 바로 기록 진입점만 둔다.
          (데이터가 있어도 이 화면에서 바로 비용을 기록할 수 있게. 예전엔 빈 상태에만 링크가 있었다.) */}
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {multiPet && activePet ? (
            <PetScopeToggle
              showAll={showAll}
              onChange={setShowAll}
              petName={activePet.name}
              petSpecies={activePet.species}
              petPhotoUrl={activePet.photo_url}
            />
          ) : activePet ? (
            <span className="text-sm text-primary-600 font-medium truncate">
              {activePet.species === 'cat' ? '🐱' : '🐶'} {t('petBasis', { name: activePet.name })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setAddMode('quick')}
            className="shrink-0 flex items-center gap-1 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold px-3 py-1.5 hover:bg-primary-100 transition-colors"
          >
            <span aria-hidden>＋</span> {t('addRecord')}
          </button>
        </div>
      </div>

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
            <button type="button" onClick={() => setAddMode('quick')}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold px-4 py-2 hover:bg-primary-100 transition-colors">
              <span aria-hidden>＋</span> {t('addRecord')}
            </button>
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

      {/* 비용 빠른 입력 — 금액+항목+날짜만. '자세히 입력'으로 전체 폼(detail)으로 전환 가능 */}
      {addMode === 'quick' && (
        <QuickCostModal
          petId={effectivePetId}
          onClose={() => setAddMode(null)}
          onDone={() => { setAddMode(null); showSavedToast() }}
          onDetail={(draft) => { setDetailDraft(draft); setAddMode('detail') }}
        />
      )}

      {/* 전체 기록 폼 — 아이를 안 고른 '전체 보기'에서는 폼 안에서 대상 아이를 고른다.
          저장 후 비용 통계(cost-records)를 즉시 갱신하고 모달을 닫는다.
          빠른입력에서 넘어온 경우 detailDraft(금액·항목·날짜)를 프리필해 재입력을 없앤다. */}
      {addMode === 'detail' && (
        <RecordFormModal
          petId={effectivePetId}
          allowPetSelect={!effectivePetId}
          title={t('addRecord')}
          defaultCategory={detailDraft?.category}
          defaultDate={detailDraft?.date}
          defaultCost={detailDraft?.amount || undefined}
          onClose={() => { setAddMode(null); setDetailDraft(null) }}
          onDone={() => { setAddMode(null); setDetailDraft(null); qc.invalidateQueries({ queryKey: ['cost-records'] }); showSavedToast() }}
        />
      )}

      {/* 저장 완료 토스트 — 화면 하단 중앙에 잠깐 뜬다 (앱 공용 저장 토스트와 동일 패턴) */}
      {justSaved && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-sm font-medium px-4 py-2 shadow-lg" role="status">
          <span aria-hidden>✓</span> {tc('saved')}
        </div>
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

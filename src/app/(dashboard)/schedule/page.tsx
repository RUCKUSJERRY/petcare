'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { PetScopeToggle } from '@/components/ui/PetScopeToggle'
import { cn, careCategoryIcon, daysUntil, elapsedBadge, ddayToneClass, todayKST } from '@/lib/utils'
import { computeUpcoming, type ScheduleRow } from '@/lib/schedule'
import { RecordForm } from '../pets/_components/RecordForm'
import { ScheduleCalendar } from './_components/ScheduleCalendar'
import { RecordsScanModal } from '../pets/_components/RecordsScanModal'
import { RecordDetailModal } from '../pets/_components/RecordDetailModal'
import { QuickLogBar } from '../pets/_components/QuickLogBar'
import { TodayTimeline } from '../pets/_components/TodayTimeline'
import { buildRecordsHtml, openPrintWindow, type ExportRecord } from '@/lib/exportRecords'
import { usePlan } from '@/hooks/usePlan'
import { useInterstitialAd } from '@/hooks/useInterstitialAd'
import { useTranslations } from 'next-intl'
import type { RecordCategory } from '@/types'

type View = 'today' | 'calendar' | 'list' | 'history'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  last_on: string | null   // 마지막 시행/발생일 (반복 규칙의 기준일)
  next_due_on: string      // 다음 예정일 — 정렬·배지 기준
  recur_rule: string | null // 반복 규칙(JSON) — 캘린더가 보이는 달로 펼쳐 그리는 데 사용
}

type HistoryItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  event_on: string
  place: string | null
  search: string
}

export default function SchedulePage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const tq = useTranslations('quickLog')
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const { data: myPets } = useMyPets()
  const { isPremium } = usePlan()
  // 보기 범위: 기본은 헤더에서 고른 아이. 여러 아이를 키우면 '전체'로 전환해 모든 아이의 일정을
  // 합쳐 본다(캘린더·목록·이력·내보내기에 반영). 스캔·오늘 기록 같은 '한 아이 대상' 액션은
  // 그대로 선택된 아이(selectedPetId)를 따른다.
  const [showAll, setShowAll] = useState(false)
  const multiPet = (myPets?.length ?? 0) >= 2
  const scopePetId = showAll ? null : selectedPetId
  const activePet = selectedPetId ? (myPets ?? []).find(p => p.id === selectedPetId) : null
  // 기본 뷰는 '캘린더' — 앱을 열면 이번 달 일정 전반을 한눈에 본다.
  // (지난/임박 정리는 '목록' 탭, 지난 일정이 있으면 상단 경보 배너로도 유도한다.)
  // 'today' 는 탭에서는 뺐지만(빠른기록 FAB·홈 요약카드가 대체) ?view=today 딥링크로는 유지한다.
  const [view, setView] = useState<View>('calendar')
  const [showAdd, setShowAdd] = useState(false)
  // 캘린더에서 특정 날짜를 눌러 추가할 때 그 날짜를 폼 기본값으로 넘긴다
  const [addDate, setAddDate] = useState<string | null>(null)
  // 반복 회차를 '이 날짜로 기록'할 때 새 기록 폼에 프리필할 라인 정보(카테고리·제목·반복규칙)
  const [addTemplate, setAddTemplate] = useState<{ category: RecordCategory; title: string; recur_rule: string | null } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusDate, setFocusDate] = useState<string | undefined>(undefined)
  const [showScan, setShowScan] = useState(false)
  const [scanNotice, setScanNotice] = useState(false)
  // 내보내기 팝업 차단은 native alert() 대신 앱 톤의 인라인 안내로 알린다(다른 안내와 통일).
  const [exportBlocked, setExportBlocked] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ?focus / ?pet / ?add / ?scan 로 진입하면 해당 동작 수행 (대시보드 바로가기 등)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const focus = params.get('focus')
    const pet = params.get('pet')
    if (pet) setSelectedPetId(pet)
    if (focus) { setView('calendar'); setFocusDate(focus) }
    if (params.get('view') === 'today') setView('today')
    if (params.get('add') === '1') setShowAdd(true)
    if (params.get('scan') === '1') setShowScan(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const { data, isLoading } = useQuery({
    queryKey: ['care-schedule'],
    queryFn: async () => {
      const empty = { upcoming: [] as ScheduleItem[], history: [] as HistoryItem[] }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return empty

      const { data: pets } = await supabase.from('pets').select('id, name, species')
      const petList = (pets ?? []) as { id: string; name: string; species: string }[]
      if (petList.length === 0) return empty
      const petMap = new Map(petList.map(p => [p.id, p]))
      const petIds = petList.map(p => p.id)
      const meta = (petId: string) => ({
        pet_name: petMap.get(petId)?.name ?? '',
        pet_species: petMap.get(petId)?.species ?? 'dog',
      })

      const { data: rows } = await supabase
        .from('records')
        .select('id, pet_id, category, title, event_on, next_due_on, recur_rule, place_name, memo')
        .in('pet_id', petIds)
        .order('event_on', { ascending: false })
        // 같은 날짜(event_on) 동점 시 '최신 기록' 선택이 흔들리지 않도록 생성순으로 2차 정렬한다.
        // (computeUpcoming 은 라인별 첫 행을 최신으로 보므로 결정적 순서가 필요하다.)
        .order('created_at', { ascending: false })

      type Row = {
        id: string; pet_id: string; category: RecordCategory; title: string
        event_on: string; next_due_on: string | null; recur_rule: string | null
        place_name: string | null; memo: string | null
      }
      const all = (rows ?? []) as Row[]

      // 예정: 라인별 최신 기록 → 다음 예정일 산출 (홈과 동일한 공용 로직)
      const upcoming: ScheduleItem[] = computeUpcoming(all as ScheduleRow[]).map(u => ({
        id: u.record_id, pet_id: u.pet_id, ...meta(u.pet_id),
        category: u.category, title: u.title, last_on: u.last_on, next_due_on: u.next_due_on,
        recur_rule: u.recur_rule,
      }))

      const history: HistoryItem[] = all.map(r => ({
        id: r.id, pet_id: r.pet_id, ...meta(r.pet_id),
        category: r.category, title: r.title, event_on: r.event_on, place: r.place_name,
        search: [r.title, r.category, r.place_name, r.memo, petMap.get(r.pet_id)?.name].filter(Boolean).join(' ').toLowerCase(),
      }))

      return {
        upcoming: upcoming.sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
        history: history.sort((a, b) => b.event_on.localeCompare(a.event_on)),
      }
    },
  })

  const items = data?.upcoming ?? []
  const history = data?.history ?? []

  const visible = scopePetId ? items.filter(i => i.pet_id === scopePetId) : items
  const visibleHistory = scopePetId ? history.filter(i => i.pet_id === scopePetId) : history
  const selectedName = scopePetId
    ? (items.find(i => i.pet_id === scopePetId)?.pet_name ?? history.find(i => i.pet_id === scopePetId)?.pet_name)
    : null

  const q = search.trim().toLowerCase()
  const searchResults = q ? visibleHistory.filter(i => i.search.includes(q)).slice(0, 50) : []

  // D-day·경과일은 반드시 KST '오늘' 기준으로 계산한다. (인자를 비우면 기기 로컬 시간대로
  // 계산돼, 기록 날짜가 KST 달력인 서버 대시보드와 자정 부근에서 하루 어긋난다.)
  const today = todayKST()
  const overdue = visible.filter(i => daysUntil(i.next_due_on, today) < 0)
  const soon = visible.filter(i => { const d = daysUntil(i.next_due_on, today); return d >= 0 && d <= 7 })
  const later = visible.filter(i => daysUntil(i.next_due_on, today) > 7)

  // OCR 스캔·기록 내보내기 직전 전면 광고(무료 사용자). 프리미엄/광고 OFF/쿨다운 시 즉시 진행.
  const { requestAd, adNode } = useInterstitialAd()

  const openScan = () => {
    setMenuOpen(false)
    if (!selectedPetId) { setScanNotice(true); return }
    setScanNotice(false)
    requestAd(() => setShowScan(true))
  }

  const [exporting, setExporting] = useState(false)
  const exportRecords = () => {
    setMenuOpen(false)
    requestAd(() => { void runExport() })
  }
  const runExport = async () => {
    setExporting(true)
    setExportBlocked(false)
    try {
      const petIds = scopePetId ? [scopePetId] : Array.from(new Set(history.map(h => h.pet_id)))
      let rows: ExportRecord[] = []
      if (petIds.length > 0) {
        const { data } = await supabase
          .from('records')
          .select('category, title, event_on, place_name, cost, memo, pet:pets(name)')
          .in('pet_id', petIds)
          .order('event_on', { ascending: false })
        rows = ((data ?? []) as unknown as Array<{
          category: string; title: string; event_on: string
          place_name: string | null; cost: number | null; memo: string | null
          pet: { name: string } | null
        }>).map(r => ({
          pet_name: r.pet?.name ?? '',
          category: r.category, title: r.title, event_on: r.event_on,
          place_name: r.place_name, cost: r.cost, memo: r.memo,
        }))
      }
      const heading = selectedName ? t('exportHeadingPet', { name: selectedName }) : t('exportHeadingAll')
      // 프리미엄은 워터마크 없는 제출용 문서, 무료는 워터마크 포함(유료 가치 차등)
      const ok = openPrintWindow(buildRecordsHtml(heading, rows, { watermark: !isPremium }))
      if (!ok) setExportBlocked(true)
    } finally {
      setExporting(false)
    }
  }

  const Row = ({ i }: { i: ScheduleItem }) => {
    // 건강 케어는 '마지막 시행으로부터 N일 경과'를 우선 표시하고(배지), 색은 예정일 긴급도로.
    // 마지막 시행일·다음 예정일은 부제로 함께 보여준다(D-day 카운트다운은 뒤로 뺀다).
    const badge = elapsedBadge(i.last_on, i.next_due_on, today)
    return (
      <button onClick={() => setDetailId(i.id)} className="w-full text-left">
        <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{i.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {i.last_on && <>{t('lastLabel')} {i.last_on.replace(/-/g, '.')} · </>}
              {t('nextLabel')} {i.next_due_on.replace(/-/g, '.')}
            </p>
          </div>
          {badge.text && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
              {badge.text}
            </span>
          )}
        </div>
      </button>
    )
  }

  // 전체 기록(이력) 한 줄 — event_on(기록일) 기준, 탭하면 상세
  const HistoryRow = ({ h }: { h: HistoryItem }) => (
    <button onClick={() => setDetailId(h.id)} className="w-full text-left">
      <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
        <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(h.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{h.pet_species === 'cat' ? '🐱' : '🐶'} {h.pet_name}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">{h.category}</span>
            {h.place && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400 truncate">{h.place}</span></>}
          </div>
          <p className="text-sm font-semibold text-gray-900 truncate">{h.title}</p>
        </div>
        <span className="text-xs text-gray-400 tabular-nums shrink-0">{h.event_on.replace(/-/g, '.')}</span>
      </div>
    </button>
  )

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        {multiPet && activePet ? (
          <PetScopeToggle
            showAll={showAll}
            onChange={setShowAll}
            petName={activePet.name}
            petSpecies={activePet.species}
            petPhotoUrl={activePet.photo_url}
          />
        ) : selectedName ? (
          <span className="text-sm text-primary-600 font-medium shrink-0">{t('petBasis', { name: selectedName })}</span>
        ) : null}
      </div>

      {/* 기록 검색 (과거 이력 포함) */}
      <div className="relative">
        <input className="input pr-8" placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100"
            aria-label={tc('close')}>✕</button>
        )}
      </div>

      {/* 지난 일정 경보 — 지난 접종·구충 등은 건강상 가장 중요하지만, 기본(캘린더) 뷰에는
          '지난 일정' 섹션이 없어 묻힌다. 검색 중이 아닐 때 모든 뷰 상단에 상시 배너로 노출하고,
          누르면 지난 일정이 정리된 목록 뷰로 보낸다. */}
      {!q && overdue.length > 0 && view !== 'list' && (
        <button
          onClick={() => setView('list')}
          className="w-full flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-left"
        >
          <span aria-hidden>⚠️</span>
          <span className="flex-1 text-sm font-semibold text-red-600">
            {t('overdueBanner', { count: overdue.length })}
          </span>
          <span className="text-xs font-semibold text-red-500 shrink-0">{t('overdueBannerCta')} ›</span>
        </button>
      )}

      {/* 보기 전환 + 추가 (검색 중에는 숨김) */}
      {!q && (
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
            {([['calendar', t('viewCalendar')], ['list', t('viewList')], ['history', t('viewHistory')]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500')}>
                {label}
              </button>
            ))}
          </div>
          {/* 기본 동작(직접 기록)은 한 번에 열고, 스캔·내보내기는 보조 메뉴(⋯)로 분리 */}
          <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
            <button
              onClick={() => {
                setMenuOpen(false); setAddDate(null); setAddTemplate(null)
                const opening = !showAdd
                setShowAdd(opening)
                // 폼을 열 때는 상단으로 스크롤해 긴 입력폼 상단이 바로 보이게 한다(캘린더 추가 경로와 동일).
                if (opening) window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={cn('text-sm py-1.5 px-3', showAdd ? 'btn-secondary' : 'btn-primary')}>
              {showAdd ? tc('close') : t('addRecord')}
            </button>
            {/* 케어 비용은 기록에서 파생되지만 전용 하단탭이 없어 이전엔 ⋯ 안에 묻혀 발견성이 낮았다 —
                기록 화면 액션 줄에 상시 아이콘 진입점을 둔다(선택 아이는 공용 컨텍스트로 유지). */}
            {!showAdd && (
              <Link
                href="/costs"
                aria-label={t('costs')}
                className="btn-secondary text-sm py-1.5 px-2.5 leading-none shrink-0"
              >
                🧾
              </Link>
            )}
            {!showAdd && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t('moreActions')}
                  className="btn-secondary text-sm py-1.5 px-2.5 leading-none">
                  ⋯
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                    <button role="menuitem" onClick={openScan}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      📷 {t('addScan')}
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    {/* 케어 비용은 액션 줄의 🧾 버튼으로 상시 노출 — 여기(⋯)서는 중복이라 제거 */}
                    <button role="menuitem" onClick={exportRecords} disabled={exporting}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      📄 {exporting ? t('exporting') : t('exportRecords')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {scanNotice && !selectedPetId && <p className="text-sm text-amber-600">{t('scanNeedPet')}</p>}

      {exportBlocked && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <span aria-hidden>⚠️</span>
          <p className="flex-1 text-sm text-amber-700">{t('exportPopupBlocked')}</p>
          <button onClick={() => setExportBlocked(false)} aria-label={tc('close')}
            className="text-amber-500 hover:text-amber-700 shrink-0">✕</button>
        </div>
      )}

      {showAdd && (
        <RecordForm
          key={`${addDate ?? 'new'}-${addTemplate?.title ?? ''}`}
          petId={selectedPetId} allowPetSelect
          defaultDate={addDate ?? undefined}
          template={addTemplate ?? undefined}
          onDone={() => { setShowAdd(false); setAddDate(null); setAddTemplate(null); qc.invalidateQueries({ queryKey: ['care-schedule'] }) }}
          onCancel={() => { setShowAdd(false); setAddDate(null); setAddTemplate(null) }}
        />
      )}

      {/* 검색 결과 */}
      {q ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">{t('searchResults', { count: searchResults.length })}</h2>
          {searchResults.length === 0 ? (
            <div className="card text-center py-10 text-sm text-gray-400">{t('searchEmpty')}</div>
          ) : (
            searchResults.map(i => (
              <button key={i.id} onClick={() => setDetailId(i.id)} className="w-full text-left">
                <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{i.category}</span>
                      {i.place && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400 truncate">{i.place}</span></>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{i.event_on.replace(/-/g, '.')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : view === 'today' ? (
        <div className="space-y-4">
          <div className="card space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">{tq('sectionTitle')}</p>
              <p className="text-xs text-gray-400">{tq('sectionSubtitle')}</p>
            </div>
            <QuickLogBar
              petId={selectedPetId}
              onOpenDetail={setDetailId}
              onLogged={() => qc.invalidateQueries({ queryKey: ['today-timeline', selectedPetId] })}
            />
          </div>
          <TodayTimeline petId={selectedPetId} showPetName={!selectedPetId} onSelect={setDetailId} />
        </div>
      ) : isLoading ? (
        <CardSkeletonList count={4} />
      ) : view === 'calendar' ? (
        <ScheduleCalendar
          items={visible}
          history={visibleHistory}
          focusDate={focusDate}
          onSelect={setDetailId}
          onAddForDate={date => {
            setAddDate(date)
            setAddTemplate(null)
            setShowAdd(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onLogOccurrence={info => {
            // 반복 예정일을 '완료로 기록' — 대상 아이를 맞추고, 라인 정보를 프리필해 폼을 연다.
            setSelectedPetId(info.petId)
            setAddTemplate({ category: info.category as RecordCategory, title: info.title, recur_rule: info.recurRule })
            setAddDate(info.date)
            setShowAdd(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      ) : view === 'history' ? (
        visibleHistory.length === 0 ? (
          <EmptyState
            icon="🗂️"
            title={t('historyEmpty')}
            hint={t('emptyHint')}
            action={
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-1.5 px-4">
                {t('addTitleItem')}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-500">{t('historyHeading', { count: visibleHistory.length })}</h2>
              <button onClick={exportRecords} disabled={exporting}
                className="btn-secondary text-xs py-1.5 px-2.5 shrink-0 disabled:opacity-50">
                📄 {exporting ? t('exporting') : t('exportRecords')}
              </button>
            </div>
            <div className="space-y-2">{visibleHistory.map(h => <HistoryRow key={h.id} h={h} />)}</div>
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title={selectedName ? t('emptyPet', { name: selectedName }) : t('emptyAll')}
          hint={t('emptyHint')}
          action={
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-1.5 px-4">
              {t('addTitleItem')}
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-red-500">{t('sectionOverdue', { count: overdue.length })}</h2>
              <div className="space-y-2">{overdue.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
          {soon.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-600">{t('sectionSoon', { count: soon.length })}</h2>
              <div className="space-y-2">{soon.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
          {later.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">{t('sectionLater', { count: later.length })}</h2>
              <div className="space-y-2">{later.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
        </div>
      )}

      {adNode}

      {showScan && selectedPetId && (
        <RecordsScanModal petId={selectedPetId}
          onClose={() => { setShowScan(false); qc.invalidateQueries({ queryKey: ['care-schedule'] }) }} />
      )}

      {detailId && (
        <RecordDetailModal recordId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

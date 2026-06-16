'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { addDays, careRecommendedCycleDays, cn, careCategoryIcon, daysUntil, ddayBadge, ddayToneClass } from '@/lib/utils'
import { ScheduleAddForm } from './_components/ScheduleAddForm'
import { ScheduleMedicalAddForm } from './_components/ScheduleMedicalAddForm'
import { ScheduleCalendar } from './_components/ScheduleCalendar'
import { RecordsScanModal } from '../pets/_components/RecordsScanModal'
import { useTranslations } from 'next-intl'

type View = 'calendar' | 'list'
type AddKind = 'care' | 'medical' | null

// 항목명(제품/백신)이 서로 다르면 별개 일정으로 봐야 하는 카테고리.
// 그 외(건강검진·미용·양치 등)는 카테고리 단위로 "최신 1건"만 집계한다.
const PRODUCT_CATEGORIES = new Set(['접종', '심장사상충', '구충', '외부기생충'])

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  kind: 'care' | 'medical'
  category: string
  title: string
  last_on: string | null   // 마지막 시행/진료일
  next_due_on: string      // 다음 예정(또는 권장)일 — 정렬·배지 기준
  estimated: boolean       // next_due가 권장주기로 추정된 값인지
}

type HistoryItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  kind: 'care' | 'medical'
  category: string
  title: string
  event_on: string         // 실제 시행/진료일
  clinic: string | null
  search: string           // 검색용 소문자 결합 텍스트
}

export default function SchedulePage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const [view, setView] = useState<View>('calendar')
  const [addKind, setAddKind] = useState<AddKind>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusDate, setFocusDate] = useState<string | undefined>(undefined)
  const [showScan, setShowScan] = useState(false)
  const [scanNotice, setScanNotice] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 대시보드 등에서 ?focus=YYYY-MM-DD&pet=ID 로 진입하면 캘린더의 해당 날짜로 포커싱
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const focus = params.get('focus')
    const pet = params.get('pet')
    if (pet) setSelectedPetId(pet)
    if (focus) { setView('calendar'); setFocusDate(focus) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 드롭다운 바깥 클릭 시 닫기
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

      // 멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환 (공동 관리로 초대받은 아이 포함)
      const { data: pets } = await supabase
        .from('pets')
        .select('id, name, species')
      const petList = (pets ?? []) as { id: string; name: string; species: string }[]
      if (petList.length === 0) return empty
      const petMap = new Map(petList.map(p => [p.id, p]))
      const petIds = petList.map(p => p.id)
      const meta = (petId: string) => ({
        pet_name: petMap.get(petId)?.name ?? '',
        pet_species: petMap.get(petId)?.species ?? 'dog',
      })

      // ── 관리 기록(접종·구충·미용·양치 등) ──
      const { data: careRows } = await supabase
        .from('vaccination_records')
        .select('id, pet_id, category, vaccine_name, vaccinated_on, next_due_on, clinic')
        .in('pet_id', petIds)
        .order('vaccinated_on', { ascending: false })

      type CareRow = { id: string; pet_id: string; category: string; vaccine_name: string; vaccinated_on: string; next_due_on: string | null; clinic: string | null }
      const careAll = (careRows ?? []) as CareRow[]

      // 예정: 항목 라인별 "최신 시행 기록"만 (제품 구분이 의미 있는 카테고리만 항목명까지 키에 포함)
      const latest = new Map<string, CareRow>()
      for (const r of careAll) {
        const key = PRODUCT_CATEGORIES.has(r.category)
          ? `${r.pet_id}|${r.category}|${r.vaccine_name}`
          : `${r.pet_id}|${r.category}`
        if (!latest.has(key)) latest.set(key, r) // 시행일 내림차순 → 첫 항목이 최신
      }
      const careItems: ScheduleItem[] = []
      for (const r of Array.from(latest.values())) {
        const cycle = careRecommendedCycleDays(r.category)
        const due = r.next_due_on ?? (cycle ? addDays(r.vaccinated_on, cycle) : null)
        if (!due) continue
        careItems.push({
          id: r.id, pet_id: r.pet_id, ...meta(r.pet_id),
          kind: 'care', category: r.category, title: r.vaccine_name,
          last_on: r.vaccinated_on, next_due_on: due,
          estimated: !r.next_due_on && !!cycle,
        })
      }

      // ── 진료 기록 ──
      const { data: medRows } = await supabase
        .from('medical_records')
        .select('id, pet_id, visited_on, next_visit_on, diagnosis, reason, treatment, medication, clinic')
        .in('pet_id', petIds)
        .order('visited_on', { ascending: false })

      type MedRow = { id: string; pet_id: string; visited_on: string; next_visit_on: string | null; diagnosis: string | null; reason: string | null; treatment: string | null; medication: string | null; clinic: string | null }
      const medAll = (medRows ?? []) as MedRow[]

      // 예정: 다음 내원 예정일이 있는 진료만
      const medItems: ScheduleItem[] = medAll
        .filter(m => m.next_visit_on)
        .map(m => ({
          id: m.id, pet_id: m.pet_id, ...meta(m.pet_id),
          kind: 'medical' as const, category: '진료',
          title: m.diagnosis || m.reason || t('medicalFallback'),
          last_on: m.visited_on, next_due_on: m.next_visit_on as string, estimated: false,
        }))

      // ── 지난 기록(검색·캘린더 히스토리용): 모든 기록을 실제 시행/진료일로 ──
      const careHistory: HistoryItem[] = careAll.map(r => ({
        id: r.id, pet_id: r.pet_id, ...meta(r.pet_id),
        kind: 'care', category: r.category, title: r.vaccine_name,
        event_on: r.vaccinated_on, clinic: r.clinic,
        search: [r.vaccine_name, r.category, r.clinic, petMap.get(r.pet_id)?.name].filter(Boolean).join(' ').toLowerCase(),
      }))
      const medHistory: HistoryItem[] = medAll.map(m => ({
        id: m.id, pet_id: m.pet_id, ...meta(m.pet_id),
        kind: 'medical', category: '진료',
        title: m.diagnosis || m.reason || t('medicalFallback'),
        event_on: m.visited_on, clinic: m.clinic,
        search: [m.diagnosis, m.reason, m.treatment, m.medication, m.clinic, '진료', petMap.get(m.pet_id)?.name].filter(Boolean).join(' ').toLowerCase(),
      }))

      return {
        upcoming: [...careItems, ...medItems].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
        history: [...careHistory, ...medHistory].sort((a, b) => b.event_on.localeCompare(a.event_on)),
      }
    },
  })

  const items = data?.upcoming ?? []
  const history = data?.history ?? []

  // 상단바에서 선택한 아이가 있으면 그 아이 일정만, 없으면 전체
  const visible = selectedPetId ? items.filter(i => i.pet_id === selectedPetId) : items
  const visibleHistory = selectedPetId ? history.filter(i => i.pet_id === selectedPetId) : history
  const selectedName = selectedPetId ? (items.find(i => i.pet_id === selectedPetId)?.pet_name ?? history.find(i => i.pet_id === selectedPetId)?.pet_name) : null

  // 검색 결과 (지난 기록 + 예정 모두 대상, 날짜 내림차순)
  const q = search.trim().toLowerCase()
  const searchResults = q
    ? visibleHistory.filter(i => i.search.includes(q)).slice(0, 50)
    : []

  // 지남 / 임박(7일 이내) / 예정으로 그룹
  const overdue = visible.filter(i => daysUntil(i.next_due_on) < 0)
  const soon = visible.filter(i => {
    const d = daysUntil(i.next_due_on)
    return d >= 0 && d <= 7
  })
  const later = visible.filter(i => daysUntil(i.next_due_on) > 7)

  const openScan = () => {
    setMenuOpen(false)
    if (!selectedPetId) { setScanNotice(true); return }
    setScanNotice(false)
    setShowScan(true)
  }

  const goToRecord = (date: string) => {
    setSearch('')
    setView('calendar')
    setFocusDate(date)
  }

  const Row = ({ i }: { i: ScheduleItem }) => {
    const badge = ddayBadge(i.next_due_on)
    const daysSince = i.last_on ? Math.max(0, -daysUntil(i.last_on)) : null
    return (
      <Link href={`/pets/${i.pet_id}`}>
        <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{i.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
            {/* 마지막 시행 후 경과 + 다음 예정(권장이면 표시) */}
            <p className="text-xs text-gray-400 mt-0.5">
              {daysSince != null && (
                <>{t('lastLabel')} {daysSince === 0 ? t('today') : t('daysAgo', { n: daysSince })} · </>
              )}
              {t('nextLabel')} {i.next_due_on}{i.estimated && <span className="text-gray-300"> {t('recommended')}</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
            {badge.text}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        {selectedName && (
          <span className="text-sm text-primary-600 font-medium shrink-0">{t('petBasis', { name: selectedName })}</span>
        )}
      </div>

      {/* 기록 검색 (과거 이력 포함) */}
      <div className="relative">
        <input
          className="input pr-8"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100"
            aria-label={tc('close')}
          >✕</button>
        )}
      </div>

      {/* 보기 전환 + 추가 (검색 중에는 숨김) */}
      {!q && (
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
            {([['calendar', t('viewCalendar')], ['list', t('viewList')]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => {
                if (addKind) { setAddKind(null); setMenuOpen(false) }
                else setMenuOpen(o => !o)
              }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cn('text-sm py-1.5 px-3', addKind ? 'btn-secondary' : 'btn-primary')}
            >
              {addKind ? tc('close') : t('addRecord')}
            </button>
            {menuOpen && !addKind && (
              <div role="menu" className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                <button
                  role="menuitem"
                  onClick={() => { setAddKind('medical'); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  🏥 {t('addMedical')}
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setAddKind('care'); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  🩹 {t('addCare')}
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  role="menuitem"
                  onClick={openScan}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  📷 {t('addScan')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanNotice && !selectedPetId && (
        <p className="text-sm text-amber-600">{t('scanNeedPet')}</p>
      )}

      {addKind === 'care' && (
        <ScheduleAddForm defaultPetId={selectedPetId} onClose={() => setAddKind(null)} />
      )}
      {addKind === 'medical' && (
        <ScheduleMedicalAddForm defaultPetId={selectedPetId} onClose={() => setAddKind(null)} />
      )}

      {/* 검색 결과 */}
      {q ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">{t('searchResults', { count: searchResults.length })}</h2>
          {searchResults.length === 0 ? (
            <div className="card text-center py-10 text-sm text-gray-400">{t('searchEmpty')}</div>
          ) : (
            searchResults.map(i => (
              <button key={`${i.kind}-${i.id}`} onClick={() => goToRecord(i.event_on)} className="w-full text-left">
                <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{i.category}</span>
                      {i.clinic && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400 truncate">{i.clinic}</span></>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{i.event_on}</span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : isLoading ? (
        <CardSkeletonList count={4} />
      ) : view === 'calendar' ? (
        <ScheduleCalendar items={visible} history={visibleHistory} focusDate={focusDate} />
      ) : visible.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗓️</div>
          {selectedName
            ? t('emptyPet', { name: selectedName })
            : t('emptyAll')}
          <p className="text-xs mt-2">{t('emptyHint')}</p>
        </div>
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

      {/* 사진/스캔으로 기록 추가 */}
      {showScan && selectedPetId && (
        <RecordsScanModal
          petId={selectedPetId}
          onClose={() => { setShowScan(false); qc.invalidateQueries({ queryKey: ['care-schedule'] }) }}
        />
      )}
    </div>
  )
}

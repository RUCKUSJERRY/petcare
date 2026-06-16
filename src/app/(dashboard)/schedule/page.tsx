'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn, careCategoryIcon, daysUntil, ddayBadge, ddayToneClass } from '@/lib/utils'
import { PRODUCT_CATEGORIES } from '@/lib/records'
import { activeNextDue } from '@/lib/recurrence'
import { RecordForm } from '../pets/_components/RecordForm'
import { ScheduleCalendar } from './_components/ScheduleCalendar'
import { RecordsScanModal } from '../pets/_components/RecordsScanModal'
import { RecordDetailModal } from '../pets/_components/RecordDetailModal'
import { useTranslations } from 'next-intl'
import type { RecordCategory } from '@/types'

type View = 'calendar' | 'list'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  last_on: string | null   // 마지막 시행/발생일
  next_due_on: string      // 다음 예정일 — 정렬·배지 기준
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
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const [view, setView] = useState<View>('calendar')
  const [showAdd, setShowAdd] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusDate, setFocusDate] = useState<string | undefined>(undefined)
  const [showScan, setShowScan] = useState(false)
  const [scanNotice, setScanNotice] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ?focus=YYYY-MM-DD&pet=ID 로 진입하면 캘린더의 해당 날짜로 포커싱
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const focus = params.get('focus')
    const pet = params.get('pet')
    if (pet) setSelectedPetId(pet)
    if (focus) { setView('calendar'); setFocusDate(focus) }
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

      type Row = {
        id: string; pet_id: string; category: RecordCategory; title: string
        event_on: string; next_due_on: string | null; recur_rule: string | null
        place_name: string | null; memo: string | null
      }
      const all = (rows ?? []) as Row[]
      const today = new Date().toISOString().slice(0, 10)

      // 예정: 항목 라인별 "최신 기록"만 (제품성 카테고리만 title까지 키에 포함)
      const latest = new Map<string, Row>()
      for (const r of all) {
        const key = PRODUCT_CATEGORIES.has(r.category)
          ? `${r.pet_id}|${r.category}|${r.title}`
          : `${r.pet_id}|${r.category}`
        if (!latest.has(key)) latest.set(key, r)
      }
      const upcoming: ScheduleItem[] = []
      for (const r of Array.from(latest.values())) {
        const due = activeNextDue(r.event_on, r.recur_rule, r.next_due_on, today)
        if (!due) continue
        upcoming.push({
          id: r.id, pet_id: r.pet_id, ...meta(r.pet_id),
          category: r.category, title: r.title, last_on: r.event_on, next_due_on: due,
        })
      }

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

  const visible = selectedPetId ? items.filter(i => i.pet_id === selectedPetId) : items
  const visibleHistory = selectedPetId ? history.filter(i => i.pet_id === selectedPetId) : history
  const selectedName = selectedPetId
    ? (items.find(i => i.pet_id === selectedPetId)?.pet_name ?? history.find(i => i.pet_id === selectedPetId)?.pet_name)
    : null

  const q = search.trim().toLowerCase()
  const searchResults = q ? visibleHistory.filter(i => i.search.includes(q)).slice(0, 50) : []

  const overdue = visible.filter(i => daysUntil(i.next_due_on) < 0)
  const soon = visible.filter(i => { const d = daysUntil(i.next_due_on); return d >= 0 && d <= 7 })
  const later = visible.filter(i => daysUntil(i.next_due_on) > 7)

  const openScan = () => {
    setMenuOpen(false)
    if (!selectedPetId) { setScanNotice(true); return }
    setScanNotice(false)
    setShowScan(true)
  }

  const Row = ({ i }: { i: ScheduleItem }) => {
    const badge = ddayBadge(i.next_due_on)
    const daysSince = i.last_on ? Math.max(0, -daysUntil(i.last_on)) : null
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
              {daysSince != null && (
                <>{t('lastLabel')} {daysSince === 0 ? t('today') : t('daysAgo', { n: daysSince })} · </>
              )}
              {t('nextLabel')} {i.next_due_on}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
            {badge.text}
          </span>
        </div>
      </button>
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
        <input className="input pr-8" placeholder={t('searchPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100"
            aria-label={tc('close')}>✕</button>
        )}
      </div>

      {/* 보기 전환 + 추가 (검색 중에는 숨김) */}
      {!q && (
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
            {([['calendar', t('viewCalendar')], ['list', t('viewList')]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500')}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => { if (showAdd) setShowAdd(false); else setMenuOpen(o => !o) }}
              aria-haspopup="menu" aria-expanded={menuOpen}
              className={cn('text-sm py-1.5 px-3', showAdd ? 'btn-secondary' : 'btn-primary')}>
              {showAdd ? tc('close') : t('addRecord')}
            </button>
            {menuOpen && !showAdd && (
              <div role="menu" className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                <button role="menuitem" onClick={() => { setShowAdd(true); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  📝 {t('addTitleItem')}
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button role="menuitem" onClick={openScan}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  📷 {t('addScan')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanNotice && !selectedPetId && <p className="text-sm text-amber-600">{t('scanNeedPet')}</p>}

      {showAdd && (
        <RecordForm
          petId={selectedPetId} allowPetSelect
          onDone={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['care-schedule'] }) }}
          onCancel={() => setShowAdd(false)}
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
                  <span className="text-xs text-gray-400 shrink-0">{i.event_on}</span>
                </div>
              </button>
            ))
          )}
        </div>
      ) : isLoading ? (
        <CardSkeletonList count={4} />
      ) : view === 'calendar' ? (
        <ScheduleCalendar items={visible} history={visibleHistory} focusDate={focusDate} onSelect={setDetailId} />
      ) : visible.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗓️</div>
          {selectedName ? t('emptyPet', { name: selectedName }) : t('emptyAll')}
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

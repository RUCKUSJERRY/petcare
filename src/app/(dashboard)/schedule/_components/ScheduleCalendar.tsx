'use client'

import { useEffect, useMemo, useState } from 'react'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'
import { useTranslations } from 'next-intl'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  next_due_on: string
}

// 지난(또는 전체) 기록 — 실제 시행/진료일에 캘린더에 표시
type HistoryItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  event_on: string
}

/** 로컬 기준 YYYY-MM-DD (시간대 영향 없이) */
function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 건강 일정 월간 캘린더.
 * 예정 일정(items)과 지난 기록(history)을 함께 표시하고,
 * 날짜를 누르면 그 날의 일정·기록을 아래에 보여준다.
 * focusDate가 들어오면 해당 월/날짜로 자동 이동·선택한다(딥링크·검색 결과 진입용).
 */
export function ScheduleCalendar({
  items,
  history = [],
  focusDate,
  onSelect,
}: {
  items: ScheduleItem[]
  history?: HistoryItem[]
  focusDate?: string
  onSelect?: (recordId: string) => void
}) {
  const t = useTranslations('schedule')
  const WEEKDAYS = t.raw('weekdays') as string[]
  const todayYMD = toYMD(new Date())
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selected, setSelected] = useState<string | null>(todayYMD)
  const [pickerOpen, setPickerOpen] = useState(false)
  // 연/월 선택 패널에서 현재 보고 있는 연도(월 선택 전 단계)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())

  // focusDate(딥링크/검색 결과)로 진입하면 해당 월·날짜로 이동
  useEffect(() => {
    if (!focusDate) return
    const [y, m, d] = focusDate.split('-').map(Number)
    if (!y || !m || !d) return
    setCursor(new Date(y, m - 1, 1))
    setSelected(focusDate)
    setPickerOpen(false)
  }, [focusDate])

  // 날짜별 예정 일정 그룹
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    items.forEach(it => {
      const arr = map.get(it.next_due_on) ?? []
      arr.push(it)
      map.set(it.next_due_on, arr)
    })
    return map
  }, [items])

  // 날짜별 지난 기록 그룹 (실제 시행/진료일 기준)
  const byDateHistory = useMemo(() => {
    const map = new Map<string, HistoryItem[]>()
    history.forEach(it => {
      const arr = map.get(it.event_on) ?? []
      arr.push(it)
      map.set(it.event_on, arr)
    })
    return map
  }, [history])

  // 표시할 6주(42칸) 그리드 계산
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay()) // 그 주 일요일부터
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const monthLabel = t('monthLabel', { year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
  const move = (delta: number) =>
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1))

  const openPicker = () => {
    setPickerYear(cursor.getFullYear())
    setPickerOpen(o => !o)
  }
  const pickMonth = (monthIdx: number) => {
    setCursor(new Date(pickerYear, monthIdx, 1))
    setPickerOpen(false)
  }
  const goToday = () => {
    const n = new Date()
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1))
    setSelected(todayYMD)
    setPickerOpen(false)
  }

  // 선택한 날짜의 항목: 예정(next_due) + 지난 기록(event_on)을 id 기준 1건으로 병합
  type DayEntry = {
    id: string; pet_name: string; pet_species: string; category: string; title: string
    isDue: boolean; due?: string
  }
  const dayList: DayEntry[] = (() => {
    if (!selected) return []
    const map = new Map<string, DayEntry>()
    for (const i of byDate.get(selected) ?? []) {
      map.set(i.id, { id: i.id, pet_name: i.pet_name, pet_species: i.pet_species, category: i.category, title: i.title, isDue: true, due: i.next_due_on })
    }
    for (const i of byDateHistory.get(selected) ?? []) {
      if (!map.has(i.id)) map.set(i.id, { id: i.id, pet_name: i.pet_name, pet_species: i.pet_species, category: i.category, title: i.title, isDue: false })
    }
    return Array.from(map.values())
  })()

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        {/* 월 네비게이션 (가운데 라벨을 누르면 연/월 선택 패널) */}
        <div className="flex items-center justify-between">
          <button onClick={() => move(-1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label={t('prevMonth')}>‹</button>
          <button
            onClick={openPicker}
            className="flex items-center gap-1 font-bold text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100"
            aria-expanded={pickerOpen}
          >
            {monthLabel}
            <span className="text-xs text-gray-400">{pickerOpen ? '▲' : '▼'}</span>
          </button>
          <button onClick={() => move(1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label={t('nextMonth')}>›</button>
        </div>

        {/* 연/월 선택 패널: 연도 먼저 고른 뒤 월 선택 */}
        {pickerOpen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setPickerYear(y => y - 1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label={t('prevYear')}>‹</button>
              <span className="font-bold text-gray-900">{t('yearLabel', { year: pickerYear })}</span>
              <button onClick={() => setPickerYear(y => y + 1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label={t('nextYear')}>›</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const isCurrent = cursor.getFullYear() === pickerYear && cursor.getMonth() === i
                return (
                  <button
                    key={i}
                    onClick={() => pickMonth(i)}
                    className={[
                      'py-2 rounded-lg text-sm font-medium transition-colors',
                      isCurrent ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    {t('monthShort', { month: i + 1 })}
                  </button>
                )
              })}
            </div>
            <button onClick={goToday} className="w-full text-sm text-primary-600 font-semibold py-1">{t('goToday')}</button>
          </div>
        ) : (
        <>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs text-gray-400">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}>{w}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map(d => {
            const ymd = toYMD(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            const dayItems = byDate.get(ymd) ?? []
            const dayHistory = byDateHistory.get(ymd) ?? []
            const isToday = ymd === todayYMD
            const isSelected = ymd === selected
            const hasOverdue = dayItems.length > 0 && ymd < todayYMD
            // 마커 색: 예정(지남=빨강, 예정=주황/프라이머리), 예정 없이 지난 기록만이면 회색
            const dot = dayItems.length > 0 ? (hasOverdue ? 'bg-red-400' : 'bg-primary-500') : 'bg-gray-300'
            const hasDot = dayItems.length > 0 || dayHistory.length > 0
            return (
              <button
                key={ymd}
                onClick={() => setSelected(ymd)}
                className="flex flex-col items-center justify-start py-1 min-h-[44px]"
              >
                <span
                  className={[
                    'w-7 h-7 flex items-center justify-center rounded-full text-sm transition-colors',
                    !inMonth ? 'text-gray-300' : 'text-gray-700',
                    isSelected ? 'bg-primary-500 text-white font-bold' : isToday ? 'ring-1 ring-primary-400 text-primary-600 font-semibold' : '',
                  ].join(' ')}
                >
                  {d.getDate()}
                </span>
                {hasDot && (
                  <span className={['mt-0.5 w-1.5 h-1.5 rounded-full', dot].join(' ')} />
                )}
              </button>
            )
          })}
        </div>
        </>
        )}
      </div>

      {/* 선택한 날짜의 일정 (구글 캘린더처럼 그 날짜 건만, 중복 없이) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">
          {selected ? selected.replace(/-/g, '.') : t('pickDate')}
          {dayList.length > 0 && (
            <span className="text-gray-400 font-normal"> {t('countSuffix', { count: dayList.length })}</span>
          )}
        </h2>
        {dayList.length === 0 ? (
          <div className="card text-center py-6 text-sm text-gray-400">{t('noScheduleThisDay')}</div>
        ) : (
          dayList.map(i => {
            const badge = i.isDue ? ddayBadge(i.due!) : null
            return (
              <button key={i.id} onClick={() => onSelect?.(i.id)} className="w-full text-left">
                <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{i.category}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
                  </div>
                  {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
                      {badge.text}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

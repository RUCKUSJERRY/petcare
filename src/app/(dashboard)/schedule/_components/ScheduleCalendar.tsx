'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  next_due_on: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 로컬 기준 YYYY-MM-DD (시간대 영향 없이) */
function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 건강 일정 월간 캘린더.
 * 일정이 있는 날에 점·건수를 표시하고, 날짜를 누르면 그 날의 일정을 아래에 보여준다.
 */
export function ScheduleCalendar({ items }: { items: ScheduleItem[] }) {
  const todayYMD = toYMD(new Date())
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selected, setSelected] = useState<string | null>(todayYMD)
  const [pickerOpen, setPickerOpen] = useState(false)
  // 연/월 선택 패널에서 현재 보고 있는 연도(월 선택 전 단계)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())

  // 날짜별 일정 그룹
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    items.forEach(it => {
      const arr = map.get(it.next_due_on) ?? []
      arr.push(it)
      map.set(it.next_due_on, arr)
    })
    return map
  }, [items])

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

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
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

  const selectedItems = selected ? byDate.get(selected) ?? [] : []

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        {/* 월 네비게이션 (가운데 라벨을 누르면 연/월 선택 패널) */}
        <div className="flex items-center justify-between">
          <button onClick={() => move(-1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label="이전 달">‹</button>
          <button
            onClick={openPicker}
            className="flex items-center gap-1 font-bold text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100"
            aria-expanded={pickerOpen}
          >
            {monthLabel}
            <span className="text-xs text-gray-400">{pickerOpen ? '▲' : '▼'}</span>
          </button>
          <button onClick={() => move(1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label="다음 달">›</button>
        </div>

        {/* 연/월 선택 패널: 연도 먼저 고른 뒤 월 선택 */}
        {pickerOpen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setPickerYear(y => y - 1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label="이전 연도">‹</button>
              <span className="font-bold text-gray-900">{pickerYear}년</span>
              <button onClick={() => setPickerYear(y => y + 1)} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500" aria-label="다음 연도">›</button>
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
                    {i + 1}월
                  </button>
                )
              })}
            </div>
            <button onClick={goToday} className="w-full text-sm text-primary-600 font-semibold py-1">오늘로</button>
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
            const isToday = ymd === todayYMD
            const isSelected = ymd === selected
            const hasOverdue = dayItems.some(() => ymd < todayYMD)
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
                {dayItems.length > 0 && (
                  <span
                    className={[
                      'mt-0.5 w-1.5 h-1.5 rounded-full',
                      hasOverdue ? 'bg-red-400' : 'bg-primary-500',
                    ].join(' ')}
                  />
                )}
              </button>
            )
          })}
        </div>
        </>
        )}
      </div>

      {/* 선택한 날짜의 일정 */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">
          {selected ? selected.replace(/-/g, '.') : '날짜를 선택하세요'}
          {selectedItems.length > 0 && <span className="text-gray-400 font-normal"> · {selectedItems.length}건</span>}
        </h2>
        {selectedItems.length === 0 ? (
          <div className="card text-center py-6 text-sm text-gray-400">이 날에는 예정된 일정이 없어요</div>
        ) : (
          selectedItems.map(i => {
            const badge = ddayBadge(i.next_due_on)
            return (
              <Link key={i.id} href={`/pets/${i.pet_id}`}>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
                    {badge.text}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

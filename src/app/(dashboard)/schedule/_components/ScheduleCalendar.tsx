'use client'

import { useEffect, useMemo, useState } from 'react'
import { careCategoryIcon, daysUntil, elapsedBadge, ddayToneClass, todayKST, addDays } from '@/lib/utils'
import { occurrencesBetween } from '@/lib/recurrence'
import { getHoliday } from '@/lib/holidays'
import { useTranslations } from 'next-intl'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: string
  title: string
  next_due_on: string
  // 반복 일정을 보이는 달 범위로 펼쳐 그리기 위한 정보 (없으면 next_due_on 한 곳에만 표시)
  last_on?: string | null
  recur_rule?: string | null
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
  onAddForDate,
  onLogOccurrence,
}: {
  items: ScheduleItem[]
  history?: HistoryItem[]
  focusDate?: string
  onSelect?: (recordId: string) => void
  /** 선택한 날짜에 새 일정 추가 (날짜 칸/선택영역의 '+ 추가'에서 호출) */
  onAddForDate?: (date: string) => void
  /** 반복 예정일(미래 회차)을 '이 날짜로 기록'할 때 — 라인 정보를 프리필해 새 기록 폼을 연다 */
  onLogOccurrence?: (info: { petId: string; category: string; title: string; recurRule: string | null; date: string }) => void
}) {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const WEEKDAYS = t.raw('weekdays') as string[]
  // 일정 데이터(next_due_on·event_on)가 모두 KST 달력 기준이므로 '오늘'도 KST로 맞춘다.
  // (기기 로컬 날짜로 계산하면 해외/오설정 기기에서 '오늘' 하이라이트·지남(빨강) 표시가 하루 어긋난다.)
  const todayYMD = todayKST()
  // 월 그리드·연/월 피커의 기준 '오늘'도 KST로 맞춘다 — 기기 로컬 날짜(new Date())로 초기화하면
  // 해외/오설정 기기에서 '이번 달'과 아래 셀의 '오늘' 하이라이트(KST 기준)가 하루 어긋난다.
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayYMD.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selected, setSelected] = useState<string | null>(todayYMD)
  const [pickerOpen, setPickerOpen] = useState(false)
  // 연/월 선택 패널에서 현재 보고 있는 연도(월 선택 전 단계) — KST 기준
  const [pickerYear, setPickerYear] = useState(() => Number(todayYMD.slice(0, 4)))

  // focusDate(딥링크/검색 결과)로 진입하면 해당 월·날짜로 이동
  useEffect(() => {
    if (!focusDate) return
    const [y, m, d] = focusDate.split('-').map(Number)
    if (!y || !m || !d) return
    setCursor(new Date(y, m - 1, 1))
    setSelected(focusDate)
    setPickerOpen(false)
  }, [focusDate])

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

  // 날짜별 예정 일정 그룹.
  // 반복 일정은 '다음 1회'만이 아니라 지금 보이는 달 범위(오늘~창의 끝)의 모든 발생일에 찍는다.
  // (예전엔 next_due_on 한 곳에만 찍혀 다음 달로 넘기면 텅 빈 달력처럼 보였다.)
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    const winFrom = toYMD(cells[0])
    const winTo = toYMD(cells[cells.length - 1])
    // 과거 칸에 예정을 새로 그리지 않도록 오늘 이후로만 펼친다(지난 실제 기록은 history 로 표시).
    const projFrom = winFrom < todayYMD ? todayYMD : winFrom
    const push = (ymd: string, it: ScheduleItem) => {
      const arr = map.get(ymd) ?? []
      arr.push(it.next_due_on === ymd ? it : { ...it, next_due_on: ymd })
      map.set(ymd, arr)
    }
    items.forEach(it => {
      // 반복 예정은 '마지막 시행일 다음날'부터 펼친다. last_on 당일은 이미 완료된 실제 기록
      // (history)으로 그려지는데, occurrencesBetween 은 base(=last_on)를 포함하므로 같은 날에
      // 예정 마커가 겹쳐 '한 날에 같은 항목 2개'로 중복돼 보였다(예: 오늘 복용 기록 + 오늘 예정).
      const from = it.last_on && addDays(it.last_on, 1) > projFrom ? addDays(it.last_on, 1) : projFrom
      const dates = it.recur_rule && it.last_on
        ? occurrencesBetween(it.recur_rule, it.last_on, from, winTo)
        : []
      if (dates.length) {
        dates.forEach(d => push(d, it))
      } else if (it.next_due_on >= winFrom && it.next_due_on <= winTo && it.next_due_on !== it.last_on) {
        // 반복이 아니거나(단발) 이 창에 발생이 없으면 저장된 다음 예정일에만 찍는다.
        // (예정일이 마지막 시행일과 같으면 이미 history 로 그려지므로 중복 방지)
        push(it.next_due_on, it)
      }
    })
    return map
  }, [items, cells, todayYMD])

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

  const monthLabel = t('monthLabel', { year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
  // 달을 이동하면 아래 '선택한 날짜' 목록도 그 달로 맞춘다(보는 달과 목록이 어긋나 보이지 않게).
  // 이동한 달에 오늘이 있으면 오늘을, 아니면 그 달 1일을 선택한다.
  const selectForMonth = (monthStart: Date) => {
    const ym = toYMD(monthStart).slice(0, 7)
    setSelected(ym === todayYMD.slice(0, 7) ? todayYMD : toYMD(monthStart))
  }
  const move = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
    setCursor(next)
    selectForMonth(next)
  }

  const openPicker = () => {
    setPickerYear(cursor.getFullYear())
    setPickerOpen(o => !o)
  }
  const pickMonth = (monthIdx: number) => {
    const next = new Date(pickerYear, monthIdx, 1)
    setCursor(next)
    selectForMonth(next)
    setPickerOpen(false)
  }
  const goToday = () => {
    // '오늘' 버튼도 KST 기준 달로 이동해 하이라이트되는 오늘 셀과 같은 달을 연다.
    const [y, m] = todayYMD.split('-').map(Number)
    setCursor(new Date(y, m - 1, 1))
    setSelected(todayYMD)
    setPickerOpen(false)
  }

  // 선택한 날짜의 항목: 예정(next_due) + 지난 기록(event_on)을 id 기준 1건으로 병합
  type DayEntry = {
    id: string; pet_id: string; pet_name: string; pet_species: string; category: string; title: string
    isDue: boolean; due?: string; last_on?: string | null; recur_rule?: string | null
  }
  const dayList: DayEntry[] = (() => {
    if (!selected) return []
    const map = new Map<string, DayEntry>()
    for (const i of byDate.get(selected) ?? []) {
      map.set(i.id, {
        id: i.id, pet_id: i.pet_id, pet_name: i.pet_name, pet_species: i.pet_species,
        category: i.category, title: i.title, isDue: true, due: i.next_due_on,
        last_on: i.last_on ?? null, recur_rule: i.recur_rule ?? null,
      })
    }
    for (const i of byDateHistory.get(selected) ?? []) {
      if (!map.has(i.id)) map.set(i.id, { id: i.id, pet_id: i.pet_id, pet_name: i.pet_name, pet_species: i.pet_species, category: i.category, title: i.title, isDue: false })
    }
    return Array.from(map.values())
  })()

  // 미래 반복 회차(예정)를 눌렀을 때 뜨는 안내 시트 대상 — 원본을 조용히 열지 않고,
  // '최근 기록 보기' 또는 '이 날짜로 기록(다음 회차 완료)' 을 고르게 한다.
  const [infoEntry, setInfoEntry] = useState<DayEntry | null>(null)

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

        {/* 날짜 그리드 — 구글 캘린더처럼 각 칸에 일정 '제목'을 글자로 보여준다 */}
        <div className="grid grid-cols-7 gap-x-0.5 gap-y-0.5">
          {cells.map(d => {
            const ymd = toYMD(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            const dayItems = byDate.get(ymd) ?? []
            const dayHistory = byDateHistory.get(ymd) ?? []
            const holiday = getHoliday(ymd)
            const isToday = ymd === todayYMD
            const isSelected = ymd === selected
            const dow = d.getDay()
            // 칸에 표시할 라벨: 공휴일 → 예정(지남=빨강/예정=프라이머리) → 지난 기록(회색)
            const labels: { text: string; cls: string }[] = []
            if (holiday) labels.push({ text: holiday, cls: 'bg-red-50 text-red-500' })
            for (const it of dayItems) {
              const overdue = ymd < todayYMD
              labels.push({ text: it.title, cls: overdue ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-700' })
            }
            for (const it of dayHistory) labels.push({ text: it.title, cls: 'bg-gray-100 text-gray-500' })
            const shown = labels.slice(0, 2)
            const moreCount = labels.length - shown.length
            // 날짜 숫자 색: 공휴일·일요일=빨강, 토요일=파랑 (선택/오늘 강조가 우선)
            const numTone = holiday || dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'
            return (
              <button
                key={ymd}
                onClick={() => {
                  setSelected(ymd)
                  // 앞뒤 달의 날짜를 누르면 그 달로 이동(구글 캘린더식)
                  if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                }}
                className={[
                  'flex flex-col items-stretch gap-0.5 min-h-[60px] p-0.5 rounded-md text-left align-top transition-colors',
                  isSelected ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50',
                  !inMonth ? 'opacity-40' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'mx-auto w-6 h-6 flex items-center justify-center rounded-full text-xs shrink-0',
                    isToday ? 'bg-primary-500 text-white font-bold' : `${numTone} ${isSelected ? 'font-bold' : ''}`,
                  ].join(' ')}
                >
                  {d.getDate()}
                </span>
                <span className="flex flex-col gap-0.5 overflow-hidden">
                  {shown.map((l, i) => (
                    <span key={i} className={`block truncate rounded px-1 text-[9px] leading-[13px] ${l.cls}`}>
                      {l.text}
                    </span>
                  ))}
                  {moreCount > 0 && (
                    <span className="block text-[9px] leading-[12px] text-gray-400 px-1">+{moreCount}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        </>
        )}
      </div>

      {/* 선택한 날짜의 일정 (구글 캘린더처럼 그 날짜 건만, 중복 없이) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-500 min-w-0 truncate">
            {selected ? selected.replace(/-/g, '.') : t('pickDate')}
            {selected && getHoliday(selected) && (
              <span className="text-red-500 font-medium"> · {getHoliday(selected)}</span>
            )}
            {dayList.length > 0 && (
              <span className="text-gray-400 font-normal"> {t('countSuffix', { count: dayList.length })}</span>
            )}
          </h2>
          {selected && onAddForDate && (
            <button
              onClick={() => onAddForDate(selected)}
              className="text-xs font-semibold text-primary-600 shrink-0 whitespace-nowrap"
            >
              {t('addOnDate')}
            </button>
          )}
        </div>
        {dayList.length === 0 ? (
          <button
            onClick={() => selected && onAddForDate?.(selected)}
            disabled={!selected || !onAddForDate}
            className="card w-full text-center py-6 text-sm text-gray-400 disabled:cursor-default hover:enabled:text-primary-600 transition-colors"
          >
            {onAddForDate ? t('noScheduleAddHint') : t('noScheduleThisDay')}
          </button>
        ) : (
          dayList.map(i => {
            // 예정(반복 회차)은 '경과일' 배지로, 톤은 예정일 긴급도로. 지난 실제 기록은 배지 없음.
            const badge = i.isDue ? elapsedBadge(i.last_on, i.due, todayYMD) : null
            // 반복 예정 회차(실체 없는 미래 발생일)를 누르면 원본을 바로 열지 않고 안내 시트를
            // 띄운다(A-1). 지난 실제 기록·단발 예정(반복 아님)은 그대로 상세/수정을 연다.
            const projectedRecurring = i.isDue && !!i.recur_rule
            return (
              <button key={i.id} onClick={() => (projectedRecurring ? setInfoEntry(i) : onSelect?.(i.id))} className="w-full text-left">
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
                  {badge && badge.text && (
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

      {/* A-1: 반복 예정일(미래 회차) 안내 시트 — 원본을 조용히 열지 않고 다음 행동을 명확히 준다 */}
      {infoEntry && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setInfoEntry(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-gray-900 flex items-center gap-1.5 min-w-0">
                <span aria-hidden>{careCategoryIcon(infoEntry.category)}</span>
                <span className="truncate">{infoEntry.title}</span>
              </p>
              <button
                onClick={() => setInfoEntry(null)}
                aria-label={tc('close')}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 shrink-0"
              >✕</button>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <p className="text-gray-600">
                {infoEntry.pet_species === 'cat' ? '🐱' : '🐶'} {infoEntry.pet_name} · {infoEntry.category}
              </p>
              <p className="text-primary-600 font-medium">
                {t('occProjected', { date: (infoEntry.due ?? selected ?? '').replace(/-/g, '.') })}
              </p>
              {infoEntry.last_on && (
                <p className="text-gray-500">
                  {t('occLastDone', {
                    date: infoEntry.last_on.replace(/-/g, '.'),
                    n: Math.max(0, -daysUntil(infoEntry.last_on, todayYMD)),
                  })}
                </p>
              )}
              <p className="text-gray-400 text-xs">{t('occProjectedHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { const id = infoEntry.id; setInfoEntry(null); onSelect?.(id) }}
                className="btn-secondary text-sm py-2"
              >{t('occViewRecord')}</button>
              <button
                onClick={() => {
                  const e = infoEntry
                  setInfoEntry(null)
                  onLogOccurrence?.({
                    petId: e.pet_id, category: e.category, title: e.title,
                    // '완료로 기록'은 실제 시행한 날(오늘)을 기본값으로 — 예정일(e.due)로 채우면
                    // 하루 늦게(예: 16일 예정을 17일에) 복용해도 기록이 16일로 남아, 다음 예정일이
                    // 실제 시행일을 반영하지 못하고 그대로 16일에 묶인다. 날짜는 폼에서 수정 가능.
                    recurRule: e.recur_rule ?? null, date: todayYMD,
                  })
                }}
                className="btn-primary text-sm py-2"
              >{t('occLogThis')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

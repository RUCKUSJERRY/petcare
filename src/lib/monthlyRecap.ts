import type { RecordCategory } from '@/types'
import { DAILY_LOG_SET } from './records'
import type { RecapRecord, RecapWalk } from './weeklyRecap'

/**
 * '월간 회고(지난달 우리 아이)' 순수 집계 로직.
 *
 * 한 달을 마무리하는 시점(새 달 초반)에 지난 한 달을 돌아보게 하는 홈 카드용 지표를 만든다.
 * 주간 리포트(weeklyRecap)와 같은 입력 형태(RecapWalk/RecapRecord)를 재사용하되, '가장 많이
 * 기록한 항목(topCategory)'과 '함께한 날 비율' 같은 월 단위에 어울리는 지표를 더한다.
 *
 * Date.now()·Math.random()·new Date() 인자 미사용(문자열 조립만) — 결정적이라 서버/클라이언트
 * 동일 재현·테스트가 가능하고, 실행 환경 시간대(UTC cron 등)에 영향받지 않는다.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export interface MonthRange {
  /** 대상 달의 첫날 'YYYY-MM-DD' */
  startStr: string
  /** 대상 달의 마지막날 'YYYY-MM-DD' */
  endStr: string
  year: number
  /** 1~12 */
  month: number
  /** 그 달의 일수 */
  daysInMonth: number
}

/** 'YYYY-MM-DD'(KST 오늘) 기준으로 '지난 달'의 날짜 범위를 구한다. (연초 경계 처리 포함) */
export function previousMonthRange(todayStr: string): MonthRange {
  const y = Number(todayStr.slice(0, 4))
  const m = Number(todayStr.slice(5, 7)) // 1~12 (이번 달)
  const year = m === 1 ? y - 1 : y
  const month = m === 1 ? 12 : m - 1
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    startStr: `${year}-${pad(month)}-01`,
    endStr: `${year}-${pad(month)}-${pad(daysInMonth)}`,
    year,
    month,
    daysInMonth,
  }
}

/**
 * 지난달 회고 카드를 노출할 시점인지 — 새 달의 초반(1~7일)에만 보여준다.
 * 달 내내 띄우면 '지난달'이 무색해지고 홈이 번잡해지므로, 월초 재방문 계기로만 쓴다.
 */
export function isMonthlyRecapWindow(todayStr: string, windowDays = 7): boolean {
  const day = Number(todayStr.slice(8, 10))
  return day >= 1 && day <= windowDays
}

export interface MonthlyRecap {
  walkCount: number
  distanceM: number
  durationS: number
  logCount: number
  spend: number
  /** 기록이 하나라도 있는 날 수 */
  activeDays: number
  daysInMonth: number
  /** 그 달 가장 많이 남긴 생활기록 항목(밥·산책·배변 등)과 횟수 — 없으면 null */
  topCategory: { category: RecordCategory; count: number } | null
}

/**
 * 한 달치(이미 기간으로 걸러진) 산책·기록에서 회고 지표를 계산한다.
 * 입력은 대상 달 [startStr, endStr] 로 조회부에서 걸러진 것을 전제한다.
 */
export function computeMonthlyRecap(
  walks: RecapWalk[],
  records: RecapRecord[],
  daysInMonth: number,
): MonthlyRecap {
  let distanceM = 0
  let durationS = 0
  const days = new Set<string>()
  for (const w of walks) {
    distanceM += w.distance_m
    durationS += w.duration_s
    if (w.dateKst) days.add(w.dateKst)
  }

  let logCount = 0
  let spend = 0
  const byCategory = new Map<RecordCategory, number>()
  for (const r of records) {
    days.add(r.event_on)
    if (r.cost && r.cost > 0) spend += r.cost
    if (DAILY_LOG_SET.has(r.category)) {
      logCount += 1
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1)
    }
  }

  // 가장 많이 남긴 항목 — 동점이면 먼저 나온(=먼저 삽입된) 항목을 유지한다(결정적).
  let topCategory: { category: RecordCategory; count: number } | null = null
  byCategory.forEach((count, category) => {
    if (!topCategory || count > topCategory.count) topCategory = { category, count }
  })

  return {
    walkCount: walks.length,
    distanceM,
    durationS,
    logCount,
    spend,
    activeDays: days.size,
    daysInMonth,
    topCategory,
  }
}

/** 회고에 보여줄 활동이 하나라도 있는지 — 전부 0이면 카드를 숨긴다(빈 카드 방지). */
export function hasMonthlyRecapActivity(r: MonthlyRecap): boolean {
  return r.walkCount > 0 || r.logCount > 0 || r.spend > 0 || r.activeDays > 0
}

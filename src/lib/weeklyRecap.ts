import type { RecordCategory } from '@/types'
import { DAILY_LOG_SET } from './records'

/**
 * '주간 리포트' 순수 집계 로직 — 재방문·체류를 유도하는 홈 카드용.
 * 최근 7일(오늘 포함)의 산책·생활기록·지출을 한눈에 요약한다.
 * Date.now()·Math.random() 미사용 — 결정적이라 서버/클라이언트 동일 재현·테스트 가능.
 */

/** 집계에 필요한 산책의 최소 형태 */
export interface RecapWalk {
  duration_s: number
  distance_m: number
}

/** 집계에 필요한 기록의 최소 형태 */
export interface RecapRecord {
  category: RecordCategory
  cost: number | null
  event_on: string // YYYY-MM-DD
}

export interface WeeklyRecap {
  walkCount: number
  distanceM: number
  durationS: number
  /** 생활기록(식사·배변·투약 등) 건수 */
  logCount: number
  /** 이번 주 지출 합계(원) */
  spend: number
  /** 기록이 하나라도 있는 날 수(0~7) — '이번 주 며칠 함께했는지' */
  activeDays: number
}

/**
 * 최근 7일 산책·기록에서 요약 지표를 계산한다.
 * 입력은 이미 기간(최근 7일)으로 걸러진 것을 전제한다(조회부에서 date 필터).
 */
export function computeWeeklyRecap(walks: RecapWalk[], records: RecapRecord[]): WeeklyRecap {
  let distanceM = 0
  let durationS = 0
  for (const w of walks) {
    distanceM += w.distance_m
    durationS += w.duration_s
  }

  let logCount = 0
  let spend = 0
  const days = new Set<string>()
  for (const r of records) {
    days.add(r.event_on)
    if (DAILY_LOG_SET.has(r.category)) logCount += 1
    if (r.cost && r.cost > 0) spend += r.cost
  }

  return {
    walkCount: walks.length,
    distanceM,
    durationS,
    logCount,
    spend,
    activeDays: days.size,
  }
}

/** 리포트에 보여줄 만한 활동이 하나라도 있는지 — 전부 0이면 카드를 숨긴다(빈 카드 방지). */
export function hasRecapActivity(r: WeeklyRecap): boolean {
  return r.walkCount > 0 || r.logCount > 0 || r.spend > 0 || r.activeDays > 0
}

// 생활 기록 패턴 — 매일 남기는 생활기록(식사·물·배변)으로부터 최근 추이와
// '개인 기준선 대비 공백(이상 신호)'을 계산한다. 순수 함수만 모아 단위 테스트가 쉽도록 구성하고,
// UI(LifePatternCard)는 이 결과를 표시만 한다. (체중은 weightInsight, 비용은 costStats 와 동일한 결)
//
// 왜 이 3종인가: 식사량·음수량·배변 빈도의 변화는 반려동물 질환의 가장 이른 신호다.
// 이미 매일 원탭으로 쌓이는 데이터인데 여태 '시간순 나열'로만 보였다 — 추이·공백으로 되살린다.

import { addDays } from './utils'

/** 패턴 분석 대상 — 빈도 변화가 건강 이상의 초기 신호가 되는 핵심 생활기록 3종 */
export const PATTERN_CATEGORIES = ['식사', '물', '배변'] as const
export type PatternCategory = (typeof PATTERN_CATEGORIES)[number]

/** 분석 기본 창(일) */
export const PATTERN_WINDOW_DAYS = 14
// 기준선(활동일 평균)을 신뢰하려면 오늘 이전에 최소 이만큼의 '기록 있던 날'이 필요.
// (며칠 안 쓴 신규 사용자에게 섣부른 이상 신호를 띄우지 않게)
const MIN_ACTIVE_DAYS_FOR_BASELINE = 3
// 며칠째 기록이 없으면 공백(이상 신호)으로 볼지. 하루 정도는 아직 입력 전일 수 있어 2일부터.
const GAP_MIN_DAYS = 2
// 카드 자체를 노출할 최소 근거 — 창 안에서 '기록이 있던 날'이 이만큼은 되어야(=실제로 기록하는 사용자).
const MIN_ACTIVE_DAYS_TO_SHOW = 4

// 공백 신호의 표시 우선순위(값이 클수록 먼저). 음수/음수량 변화가 임상적으로 더 급함.
const CATEGORY_PRIORITY: Record<PatternCategory, number> = { 물: 3, 배변: 2, 식사: 1 }

export type LogRecord = { category: string; event_on: string } // event_on: YYYY-MM-DD (KST)

export type PatternAnomaly = { kind: 'gap'; days: number }

export interface CategoryPattern {
  category: PatternCategory
  /** 길이 = days, 오래된→오늘 순 일자별 기록 수 */
  series: number[]
  /** 오늘 기록 수 */
  today: number
  /** 창 내 총 기록 수 */
  total: number
  /** 창 내 '기록이 있던 날' 수 */
  activeDays: number
  /** 기준선: 오늘 이전 창에서 '기록이 있던 날'의 하루 평균 횟수. 근거 부족 시 null */
  baseline: number | null
  /** 마지막 기록으로부터 경과일(오늘 있으면 0, 창 안에 전혀 없으면 null) */
  daysSinceLast: number | null
  /** 이상 신호(공백). 없으면 null */
  anomaly: PatternAnomaly | null
}

export interface LifePattern {
  days: number
  from: string // 창 시작일(YYYY-MM-DD)
  to: string // 오늘(YYYY-MM-DD)
  categories: CategoryPattern[]
  /** 세 카테고리 통틀어 '기록이 있던 날' 수(중복 제외) */
  activeDaysTotal: number
  /** 카드 노출 근거가 충분한지 */
  hasEnoughData: boolean
  /** 가장 중요한 이상 신호(있으면) — 카드 상단 배너용 */
  headline: { category: PatternCategory; anomaly: PatternAnomaly } | null
}

/**
 * 생활기록으로부터 패턴/이상 신호를 계산한다.
 * @param logs   생활기록 목록(카테고리·날짜만 필요, 정렬 무관)
 * @param today  KST '오늘'(YYYY-MM-DD)
 * @param days   분석 창 길이(기본 14)
 */
export function computeLifePattern(logs: LogRecord[], today: string, days: number = PATTERN_WINDOW_DAYS): LifePattern {
  const from = addDays(today, -(days - 1))
  // 창 안의 각 날짜(오래된→오늘) — 인덱스로 series 를 채운다.
  const dates: string[] = Array.from({ length: days }, (_, i) => addDays(from, i))
  const indexOfDate = new Map(dates.map((d, i) => [d, i]))

  // 카테고리별 일자 카운트 집계
  const counts: Record<PatternCategory, number[]> = {
    식사: new Array(days).fill(0),
    물: new Array(days).fill(0),
    배변: new Array(days).fill(0),
  }
  for (const r of logs) {
    if (!(r.category in counts)) continue
    const idx = indexOfDate.get(r.event_on)
    if (idx === undefined) continue // 창 밖(또는 오늘 이후) 기록은 무시
    counts[r.category as PatternCategory][idx] += 1
  }

  const activeDateSet = new Set<string>()

  const categories: CategoryPattern[] = PATTERN_CATEGORIES.map(category => {
    const series = counts[category]
    const todayCount = series[days - 1]
    const total = series.reduce((a, b) => a + b, 0)
    const activeDays = series.filter(c => c > 0).length

    // 세 카테고리 통합 활동일 집계(중복 제외)
    series.forEach((c, i) => { if (c > 0) activeDateSet.add(dates[i]) })

    // 기준선: 오늘(마지막 인덱스) 제외한 창에서 활동일 평균
    let activeBefore = 0
    let sumBefore = 0
    for (let i = 0; i < days - 1; i++) {
      if (series[i] > 0) { activeBefore += 1; sumBefore += series[i] }
    }
    const baseline = activeBefore >= MIN_ACTIVE_DAYS_FOR_BASELINE ? +(sumBefore / activeBefore).toFixed(1) : null

    // 마지막 기록 경과일
    let daysSinceLast: number | null = null
    for (let i = days - 1; i >= 0; i--) {
      if (series[i] > 0) { daysSinceLast = days - 1 - i; break }
    }

    // 이상 신호: 평소 규칙적으로 기록하던(baseline 존재) 카테고리에서 GAP_MIN_DAYS 이상 공백일 때만.
    // (근거가 약하면 섣불리 알리지 않는다)
    const anomaly: PatternAnomaly | null =
      baseline != null && daysSinceLast != null && daysSinceLast >= GAP_MIN_DAYS
        ? { kind: 'gap', days: daysSinceLast }
        : null

    return { category, series, today: todayCount, total, activeDays, baseline, daysSinceLast, anomaly }
  })

  const activeDaysTotal = activeDateSet.size

  // 헤드라인: 이상 신호가 있는 카테고리 중 우선순위·공백일수가 큰 것 하나
  const flagged = categories
    .filter(c => c.anomaly)
    .sort((a, b) =>
      b.anomaly!.days - a.anomaly!.days ||
      CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category])
  const headline = flagged.length ? { category: flagged[0].category, anomaly: flagged[0].anomaly! } : null

  return {
    days,
    from,
    to: today,
    categories,
    activeDaysTotal,
    hasEnoughData: activeDaysTotal >= MIN_ACTIVE_DAYS_TO_SHOW,
    headline,
  }
}

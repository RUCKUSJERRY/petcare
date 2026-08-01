// 체중 추세 인사이트 — 체중 로그로부터 최근 추세·목표 도달 예상·급변 경고를 계산한다.
// 순수 함수만 모아 단위 테스트가 쉽도록 구성. UI는 이 결과를 표시만 한다.

import { parseYMD, ymd } from './recurrence'

export type WeightPoint = { weight_kg: number; measured_on: string } // measured_on: YYYY-MM-DD

export type TrendDirection = 'up' | 'down' | 'flat'

export interface WeightInsight {
  /** 주당 추세(kg/주). 표본이 2개 미만이면 null */
  trendPerWeek: number | null
  direction: TrendDirection
  /** 현재 추세로 목표 체중에 도달하는 예상 날짜(YYYY-MM-DD). 추세가 목표와 반대거나 목표 없음이면 null */
  projectedGoalDate: string | null
  /** 직전 측정 대비 급격한 변화(비율). 임계 미만이면 null */
  suddenChange: { pct: number; up: boolean } | null
  /** 최신 체중 − 목표 (양수=감량 필요, 음수=증량 필요) */
  toGoal: number | null
}

const DAY = 86400000
// 최근 추세는 마지막 N개 표본으로 본다(오래된 변화에 끌리지 않게).
const TREND_WINDOW = 6
// 주당 |0.02kg| 미만은 사실상 유지로 본다.
const FLAT_BAND = 0.02
// 직전 대비 7% 이상 변화 + 31일 이내 측정이면 급변 경고.
const SUDDEN_PCT = 0.07
const SUDDEN_MAX_GAP_DAYS = 31

/** 최소제곱 직선 기울기(kg/일). 표본 < 2거나 모든 x가 같으면 null */
function slopePerDay(points: WeightPoint[]): number | null {
  if (points.length < 2) return null
  const x0 = parseYMD(points[0].measured_on).getTime()
  const xs = points.map(p => (parseYMD(p.measured_on).getTime() - x0) / DAY)
  const ys = points.map(p => p.weight_kg)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return num / den
}

/**
 * 체중 로그(시간순 무관)로부터 추세 인사이트 계산.
 * @param logs 체중 로그
 * @param goal 목표 체중(kg) 또는 null
 */
export function computeWeightInsight(logs: WeightPoint[], goal: number | null): WeightInsight {
  const sorted = [...logs].sort((a, b) => a.measured_on.localeCompare(b.measured_on))
  const empty: WeightInsight = { trendPerWeek: null, direction: 'flat', projectedGoalDate: null, suddenChange: null, toGoal: null }
  if (sorted.length === 0) return empty

  const latest = sorted[sorted.length - 1]
  const toGoal = goal != null ? +(latest.weight_kg - goal).toFixed(2) : null

  // 추세
  const window = sorted.slice(-TREND_WINDOW)
  const perDay = slopePerDay(window)
  const trendPerWeek = perDay == null ? null : +(perDay * 7).toFixed(3)
  const direction: TrendDirection =
    trendPerWeek == null || Math.abs(trendPerWeek) < FLAT_BAND ? 'flat' : trendPerWeek > 0 ? 'up' : 'down'

  // 목표 도달 예상일 — 추세가 '유지'가 아니고(direction 과 모순 방지) 목표 방향과 일치할 때만.
  // (direction 은 FLAT_BAND 로 유지 판정하는데, projectedGoalDate 가 raw perDay 만 보면
  //  "유지"라면서 도달 예상일이 함께 뜨는 모순이 생긴다 — 판정 기준을 direction 으로 통일.)
  let projectedGoalDate: string | null = null
  if (goal != null && perDay != null && direction !== 'flat') {
    const remaining = goal - latest.weight_kg // 목표까지 (kg)
    const movingTowardGoal = Math.sign(remaining) === Math.sign(perDay)
    if (movingTowardGoal && Math.abs(remaining) > 0.01) {
      const days = Math.ceil(remaining / perDay)
      if (days > 0 && days <= 730) {
        const d = new Date(parseYMD(latest.measured_on).getTime() + days * DAY)
        projectedGoalDate = ymd(d)
      }
    }
  }

  // 급변 경고 — 직전 측정 대비
  let suddenChange: WeightInsight['suddenChange'] = null
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2]
    const gapDays = (parseYMD(latest.measured_on).getTime() - parseYMD(prev.measured_on).getTime()) / DAY
    // 같은 날(gapDays===0) 두 번 잰 식전/식후 차이로 '급변' 오경고가 뜨지 않도록 하루 이상 간격만 본다.
    if (prev.weight_kg > 0 && gapDays >= 1 && gapDays <= SUDDEN_MAX_GAP_DAYS) {
      const pct = (latest.weight_kg - prev.weight_kg) / prev.weight_kg
      if (Math.abs(pct) >= SUDDEN_PCT) suddenChange = { pct: +pct.toFixed(3), up: pct > 0 }
    }
  }

  return { trendPerWeek, direction, projectedGoalDate, suddenChange, toGoal }
}

import { describe, it, expect } from 'vitest'
import { computeLifePattern, PATTERN_WINDOW_DAYS } from './recordStats'
import { addDays } from './utils'

const TODAY = '2026-07-31'

/** today 로부터 n일 전 날짜(YYYY-MM-DD) */
const ago = (n: number) => addDays(TODAY, -n)

/** 카테고리·(며칠 전) 조합으로 로그 레코드를 만든다 */
const rec = (category: string, daysAgo: number) => ({ category, event_on: ago(daysAgo) })

/** 어떤 카테고리를 여러 날에 걸쳐 매일 count 회 기록한 로그 생성 */
const daily = (category: string, fromDaysAgo: number, toDaysAgo: number, count = 1) => {
  const out: { category: string; event_on: string }[] = []
  for (let d = fromDaysAgo; d >= toDaysAgo; d--) {
    for (let c = 0; c < count; c++) out.push(rec(category, d))
  }
  return out
}

describe('computeLifePattern', () => {
  it('기록이 없으면 hasEnoughData=false, 헤드라인 없음', () => {
    const r = computeLifePattern([], TODAY)
    expect(r.hasEnoughData).toBe(false)
    expect(r.headline).toBeNull()
    expect(r.activeDaysTotal).toBe(0)
    expect(r.categories).toHaveLength(3)
  })

  it('창(days) 길이만큼 series 를 채우고 오늘이 마지막 인덱스', () => {
    const r = computeLifePattern([rec('식사', 0), rec('식사', 0)], TODAY)
    const meal = r.categories.find(c => c.category === '식사')!
    expect(meal.series).toHaveLength(PATTERN_WINDOW_DAYS)
    expect(meal.series[PATTERN_WINDOW_DAYS - 1]).toBe(2) // 오늘 2건
    expect(meal.today).toBe(2)
    expect(meal.total).toBe(2)
    expect(meal.daysSinceLast).toBe(0)
  })

  it('창 밖(오늘 이후·창 이전) 기록은 무시한다', () => {
    const logs = [
      { category: '물', event_on: addDays(TODAY, 1) }, // 미래
      { category: '물', event_on: addDays(TODAY, -PATTERN_WINDOW_DAYS) }, // 창 이전(14일 전 = 인덱스 밖)
      rec('물', 0),
    ]
    const r = computeLifePattern(logs, TODAY)
    const water = r.categories.find(c => c.category === '물')!
    expect(water.total).toBe(1)
    expect(water.today).toBe(1)
  })

  it('매일 규칙적으로 기록하면 기준선(활동일 평균) 계산', () => {
    // 12일 전~오늘까지 매일 물 2회
    const r = computeLifePattern(daily('물', 12, 0, 2), TODAY)
    const water = r.categories.find(c => c.category === '물')!
    expect(water.baseline).toBe(2) // 활동일 평균 2회
    expect(water.anomaly).toBeNull() // 오늘도 기록 → 공백 없음
    expect(r.hasEnoughData).toBe(true)
  })

  it('활동일이 부족하면(기준선 근거 부족) 이상 신호를 내지 않는다', () => {
    // 2일만 기록(오늘 이전 활동일 < 3) → baseline null → 공백이어도 anomaly 없음
    const r = computeLifePattern([rec('배변', 6), rec('배변', 5)], TODAY)
    const poop = r.categories.find(c => c.category === '배변')!
    expect(poop.baseline).toBeNull()
    expect(poop.anomaly).toBeNull()
  })

  it('규칙적이던 카테고리가 2일 이상 공백이면 gap 이상 신호', () => {
    // 10일 전~2일 전까지 매일 물 기록, 최근 2일(어제·오늘)은 공백
    const r = computeLifePattern(daily('물', 10, 2), TODAY)
    const water = r.categories.find(c => c.category === '물')!
    expect(water.baseline).not.toBeNull()
    expect(water.daysSinceLast).toBe(2)
    expect(water.anomaly).toEqual({ kind: 'gap', days: 2 })
    expect(r.headline).toEqual({ category: '물', anomaly: { kind: 'gap', days: 2 } })
  })

  it('하루 공백(어제까지 기록)은 이상 신호로 보지 않는다', () => {
    // 10일 전~어제까지 매일, 오늘만 아직 공백 → daysSinceLast=1 < GAP_MIN(2)
    const r = computeLifePattern(daily('식사', 10, 1), TODAY)
    const meal = r.categories.find(c => c.category === '식사')!
    expect(meal.daysSinceLast).toBe(1)
    expect(meal.anomaly).toBeNull()
  })

  it('여러 공백 중 우선순위(물>배변>식사)·공백일수로 헤드라인을 고른다', () => {
    const logs = [
      ...daily('식사', 10, 3), // 식사: 3일 공백
      ...daily('배변', 10, 2), // 배변: 2일 공백
    ]
    const r = computeLifePattern(logs, TODAY)
    // 공백일수 큰 식사(3)가 배변(2)보다 우선
    expect(r.headline?.category).toBe('식사')
    expect(r.headline?.anomaly.days).toBe(3)
  })

  it('같은 공백일수면 임상 우선순위(물)가 앞선다', () => {
    const logs = [
      ...daily('물', 10, 2), // 물: 2일 공백
      ...daily('배변', 10, 2), // 배변: 2일 공백
    ]
    const r = computeLifePattern(logs, TODAY)
    expect(r.headline?.category).toBe('물')
  })

  it('activeDaysTotal 은 세 카테고리 통합 중복 제외 활동일 수', () => {
    // 같은 날 물+배변을 기록해도 활동일은 1일로 센다
    const logs = [rec('물', 3), rec('배변', 3), rec('식사', 2)]
    const r = computeLifePattern(logs, TODAY)
    expect(r.activeDaysTotal).toBe(2) // 3일 전, 2일 전
  })
})

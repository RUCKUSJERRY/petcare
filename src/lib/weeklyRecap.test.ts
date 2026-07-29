import { describe, expect, it } from 'vitest'
import { computeWeeklyRecap, hasRecapActivity, type RecapRecord, type RecapWalk } from './weeklyRecap'

describe('computeWeeklyRecap', () => {
  it('산책 합계·기록 건수·지출·활동일을 집계한다', () => {
    const walks: RecapWalk[] = [
      { duration_s: 600, distance_m: 800 },
      { duration_s: 1200, distance_m: 1500 },
    ]
    const records: RecapRecord[] = [
      { category: '식사', cost: null, event_on: '2026-07-27' },
      { category: '배변', cost: null, event_on: '2026-07-27' },
      { category: '진료', cost: 30000, event_on: '2026-07-28' }, // 비용은 있지만 생활기록 아님
      { category: '식사', cost: null, event_on: '2026-07-29' },
    ]
    const r = computeWeeklyRecap(walks, records)
    expect(r.walkCount).toBe(2)
    expect(r.distanceM).toBe(2300)
    expect(r.durationS).toBe(1800)
    expect(r.logCount).toBe(3) // 식사·배변·식사 (진료 제외)
    expect(r.spend).toBe(30000)
    expect(r.activeDays).toBe(3) // 27·28·29
  })

  it('활동이 전혀 없으면 hasRecapActivity=false', () => {
    const r = computeWeeklyRecap([], [])
    expect(hasRecapActivity(r)).toBe(false)
    expect(r.activeDays).toBe(0)
  })

  it('기록만 있어도 활동으로 본다', () => {
    const r = computeWeeklyRecap([], [{ category: '식사', cost: null, event_on: '2026-07-29' }])
    expect(hasRecapActivity(r)).toBe(true)
  })
})

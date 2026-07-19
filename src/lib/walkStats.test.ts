import { describe, expect, it } from 'vitest'
import { summarizeWalks, weeklyGoalProgress, type WalkLike, type WalkTotals } from './walkStats'

// 기준: 2026-06-17(수) KST. 그 주 월요일 = 2026-06-15.
// 집계는 KST 기준이므로 타임존을 명시(+09:00)해 CI 시간대와 무관하게 결정적으로 검증한다.
const NOW = new Date('2026-06-17T12:00:00+09:00')

const walks: WalkLike[] = [
  { started_at: '2026-06-17T08:00:00+09:00', distance_m: 1000, duration_s: 600 }, // 이번 주/달
  { started_at: '2026-06-15T08:00:00+09:00', distance_m: 2000, duration_s: 1200 }, // 이번 주(월)/달
  { started_at: '2026-06-08T08:00:00+09:00', distance_m: 3000, duration_s: 1800 }, // 지난 주/이번 달
  { started_at: '2026-05-30T08:00:00+09:00', distance_m: 5000, duration_s: 3000 }, // 지난 달
  { started_at: 'invalid', distance_m: 9999, duration_s: 9999 },                    // 무시
]

describe('summarizeWalks', () => {
  it('이번 주 합계 (월요일 시작)', () => {
    const s = summarizeWalks(walks, NOW)
    expect(s.thisWeek).toEqual({ count: 2, distance_m: 3000, duration_s: 1800 })
  })

  it('이번 달 합계', () => {
    const s = summarizeWalks(walks, NOW)
    expect(s.thisMonth).toEqual({ count: 3, distance_m: 6000, duration_s: 3600 })
  })

  it('전체 합계 (잘못된 날짜 제외)', () => {
    const s = summarizeWalks(walks, NOW)
    expect(s.all).toEqual({ count: 4, distance_m: 11000, duration_s: 6600 })
  })

  it('주간 추이 버킷 — 길이/최신 주/최댓값', () => {
    const s = summarizeWalks(walks, NOW, 6)
    expect(s.weekly).toHaveLength(6)
    const last = s.weekly[s.weekly.length - 1]
    expect(last.weekStart).toBe('2026-06-15')
    expect(last.distance_m).toBe(3000) // 이번 주
    expect(s.weekly[s.weekly.length - 2].distance_m).toBe(3000) // 지난 주(06-08)
    expect(s.maxWeekDistance).toBe(5000) // 05-25 주(05-30 산책)
  })

  it('빈 입력', () => {
    const s = summarizeWalks([], NOW)
    expect(s.all.count).toBe(0)
    expect(s.weekly).toHaveLength(6)
    expect(s.maxWeekDistance).toBe(0)
  })

  it('KST 자정 직후 산책은 KST 기준 주/달로 잡힌다 (UTC 로 새면 지난 주로 오분류)', () => {
    // 2026-06-15 00:30 KST(월) = 2026-06-14 15:30 UTC(일). UTC 로 묶으면 지난 주가 되지만,
    // KST 기준으로는 이번 주(월요일 06-15) 이번 달에 정확히 들어가야 한다.
    const s = summarizeWalks(
      [{ started_at: '2026-06-15T00:30:00+09:00', distance_m: 1200, duration_s: 700 }],
      NOW,
    )
    expect(s.thisWeek).toEqual({ count: 1, distance_m: 1200, duration_s: 700 })
    expect(s.thisMonth.count).toBe(1)
    expect(s.weekly[s.weekly.length - 1].distance_m).toBe(1200)
  })
})

describe('weeklyGoalProgress', () => {
  const week = (distance_m: number, count: number): WalkTotals => ({ distance_m, count, duration_s: 0 })

  it('목표 미설정이면 hasGoal=false', () => {
    const p = weeklyGoalProgress(week(5000, 3), { distanceKm: 0, count: 0 })
    expect(p.hasGoal).toBe(false)
    expect(p.achieved).toBe(false)
  })

  it('거리 목표 진행률·달성', () => {
    const p = weeklyGoalProgress(week(3000, 2), { distanceKm: 10, count: 0 })
    expect(p.distance.active).toBe(true)
    expect(p.distance.pct).toBe(30)
    expect(p.distance.met).toBe(false)
    expect(p.distance.remainingM).toBe(7000)
    expect(p.achieved).toBe(false)

    const done = weeklyGoalProgress(week(12000, 1), { distanceKm: 10, count: 0 })
    expect(done.distance.pct).toBe(100) // 초과해도 100 클램프
    expect(done.distance.met).toBe(true)
    expect(done.achieved).toBe(true)
  })

  it('횟수 목표', () => {
    const p = weeklyGoalProgress(week(0, 3), { distanceKm: 0, count: 5 })
    expect(p.count.pct).toBe(60)
    expect(p.count.remaining).toBe(2)
    expect(p.achieved).toBe(false)
  })

  it('거리+횟수 모두 설정 시 둘 다 충족해야 달성', () => {
    const partial = weeklyGoalProgress(week(10000, 2), { distanceKm: 8, count: 5 })
    expect(partial.distance.met).toBe(true)
    expect(partial.count.met).toBe(false)
    expect(partial.achieved).toBe(false)

    const all = weeklyGoalProgress(week(10000, 5), { distanceKm: 8, count: 5 })
    expect(all.achieved).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { summarizeWalks, type WalkLike } from './walkStats'

// 기준: 2026-06-17(수). 그 주 월요일 = 2026-06-15.
const NOW = new Date('2026-06-17T12:00:00')

const walks: WalkLike[] = [
  { started_at: '2026-06-17T08:00:00', distance_m: 1000, duration_s: 600 }, // 이번 주/달
  { started_at: '2026-06-15T08:00:00', distance_m: 2000, duration_s: 1200 }, // 이번 주(월)/달
  { started_at: '2026-06-08T08:00:00', distance_m: 3000, duration_s: 1800 }, // 지난 주/이번 달
  { started_at: '2026-05-30T08:00:00', distance_m: 5000, duration_s: 3000 }, // 지난 달
  { started_at: 'invalid', distance_m: 9999, duration_s: 9999 },             // 무시
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
})

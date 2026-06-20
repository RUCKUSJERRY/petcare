import { describe, expect, it } from 'vitest'
import { aggregateCostStats, costYears, type CostRecord } from './costStats'

const rows: CostRecord[] = [
  { category: '진료', event_on: '2026-01-10', cost: 30000 },
  { category: '진료', event_on: '2026-01-20', cost: 20000 },
  { category: '미용', event_on: '2026-03-05', cost: 50000 },
  { category: '접종', event_on: '2026-03-15', cost: 25000 },
  { category: '간식', event_on: '2026-03-15', cost: null },   // 비용 없음 → 제외
  { category: '진료', event_on: '2025-12-31', cost: 99999 },  // 다른 연도 → 제외
  { category: '목욕', event_on: '2026-06-01', cost: 0 },      // 0원 → 제외
]

describe('aggregateCostStats', () => {
  it('연도 총합·건수 집계 (cost 없음/0/타연도 제외)', () => {
    const s = aggregateCostStats(rows, 2026)
    expect(s.total).toBe(125000)
    expect(s.count).toBe(4)
  })

  it('월별 집계 (1~12월 길이 보장)', () => {
    const s = aggregateCostStats(rows, 2026)
    expect(s.byMonth).toHaveLength(12)
    expect(s.byMonth[0]).toEqual({ month: 1, total: 50000, count: 2 }) // 1월
    expect(s.byMonth[2]).toEqual({ month: 3, total: 75000, count: 2 }) // 3월
    expect(s.byMonth[5].total).toBe(0)                                 // 6월(0원 제외)
    expect(s.maxMonthTotal).toBe(75000)
  })

  it('카테고리별 집계 — 지출 큰 순 정렬', () => {
    const s = aggregateCostStats(rows, 2026)
    expect(s.byCategory[0]).toEqual({ category: '진료', total: 50000, count: 2 })
    expect(s.byCategory[1]).toEqual({ category: '미용', total: 50000, count: 1 })
    expect(s.byCategory.map(c => c.category)).toContain('접종')
  })

  it('빈 입력은 0 통계', () => {
    const s = aggregateCostStats([], 2026)
    expect(s.total).toBe(0)
    expect(s.byCategory).toHaveLength(0)
    expect(s.maxMonthTotal).toBe(0)
  })
})

describe('costYears', () => {
  it('비용 기록이 있는 연도만 내림차순', () => {
    expect(costYears(rows)).toEqual([2026, 2025])
  })
  it('비용 기록이 없으면 올해', () => {
    expect(costYears([])).toEqual([new Date().getFullYear()])
  })
})

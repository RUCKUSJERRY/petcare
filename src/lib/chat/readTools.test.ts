import { describe, expect, it } from 'vitest'
import { formatWalkSummary, formatCostStats, formatUpcoming, formatRecentRecords } from './readTools'
import type { WalkSummary } from '@/lib/walkStats'
import type { CostStats } from '@/lib/costStats'
import type { UpcomingItem } from '@/lib/schedule'

describe('formatWalkSummary', () => {
  const base: WalkSummary = {
    thisWeek: { count: 3, distance_m: 4200, duration_s: 3600 },
    thisMonth: { count: 10, distance_m: 15000, duration_s: 12000 },
    all: { count: 50, distance_m: 90000, duration_s: 70000 },
    weekly: [], maxWeekDistance: 0,
  }
  it('이번 주/달/전체 요약, km·분 표기', () => {
    const t = formatWalkSummary('콩이', base)
    expect(t).toContain('콩이 산책 요약')
    expect(t).toContain('이번 주: 3회, 4.2km, 60분')
    expect(t).toContain('전체: 50회')
  })
  it('기록 없으면 안내', () => {
    expect(formatWalkSummary('콩이', { ...base, all: { count: 0, distance_m: 0, duration_s: 0 } }))
      .toContain('산책 기록이 아직 없어요')
  })
})

describe('formatCostStats', () => {
  const s: CostStats = {
    year: 2026, total: 150000, count: 5,
    byMonth: [], maxMonthTotal: 0,
    byCategory: [{ category: '진료', total: 100000, count: 2 }, { category: '미용', total: 50000, count: 3 }] as CostStats['byCategory'],
  }
  it('총액 + 카테고리 top', () => {
    const t = formatCostStats('별이', s)
    expect(t).toContain('2026년 비용')
    expect(t).toContain('150,000원')
    expect(t).toContain('진료 100,000원')
  })
  it('기록 없으면 안내', () => {
    expect(formatCostStats('별이', { ...s, count: 0 })).toContain('비용 기록이 없어요')
  })
})

describe('formatUpcoming', () => {
  const items: UpcomingItem[] = [
    { record_id: '1', pet_id: 'p', category: '심장사상충', title: '심장사상충', last_on: '2026-09-01', next_due_on: '2026-10-25', recur_rule: null },
    { record_id: '2', pet_id: 'p', category: '접종', title: '종합백신', last_on: '2026-01-01', next_due_on: '2026-10-20', recur_rule: null },
  ]
  it('가까운 순 정렬 + D-day', () => {
    const t = formatUpcoming('콩이', items, '2026-10-19')
    const lines = t.split('\n')
    // 2026-10-20(D-1)이 2026-10-25(D-6)보다 먼저
    expect(lines[1]).toContain('종합백신')
    expect(lines[1]).toContain('D-1')
    expect(lines[2]).toContain('D-6')
  })
  it('지난 일정은 "지남"', () => {
    const t = formatUpcoming('콩이', [items[1]], '2026-10-25')
    expect(t).toContain('5일 지남')
  })
  it('없으면 안내', () => {
    expect(formatUpcoming('콩이', [], '2026-10-19')).toContain('예정된 건강 관리 일정이 없어요')
  })
})

describe('formatRecentRecords', () => {
  it('날짜·카테고리·메모 나열', () => {
    const t = formatRecentRecords('콩이', [
      { category: '식사', event_on: '2026-10-19', title: '식사', memo: '사료 50g' },
      { category: '산책', event_on: '2026-10-18', title: '산책' },
    ])
    expect(t).toContain('2026-10-19 식사 — 사료 50g')
    expect(t).toContain('2026-10-18 산책')
  })
  it('없으면 안내', () => {
    expect(formatRecentRecords('콩이', [])).toContain('최근 기록이 없어요')
  })
})

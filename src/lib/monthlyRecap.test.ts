import { describe, it, expect } from 'vitest'
import {
  previousMonthRange,
  isMonthlyRecapWindow,
  computeMonthlyRecap,
  hasMonthlyRecapActivity,
} from './monthlyRecap'
import type { RecapRecord, RecapWalk } from './weeklyRecap'

describe('previousMonthRange', () => {
  it('달 중간이면 직전 달의 1일~말일을 준다', () => {
    expect(previousMonthRange('2026-08-05')).toEqual({
      startStr: '2026-07-01', endStr: '2026-07-31', year: 2026, month: 7, daysInMonth: 31,
    })
  })

  it('2월(윤년 아님) 말일은 28일', () => {
    expect(previousMonthRange('2026-03-02')).toMatchObject({ month: 2, endStr: '2026-02-28', daysInMonth: 28 })
  })

  it('윤년 2월 말일은 29일', () => {
    expect(previousMonthRange('2028-03-02')).toMatchObject({ month: 2, endStr: '2028-02-29', daysInMonth: 29 })
  })

  it('연초(1월)는 전년 12월로 넘어간다', () => {
    expect(previousMonthRange('2026-01-04')).toEqual({
      startStr: '2025-12-01', endStr: '2025-12-31', year: 2025, month: 12, daysInMonth: 31,
    })
  })
})

describe('isMonthlyRecapWindow', () => {
  it('월초 1~7일은 노출 시점', () => {
    expect(isMonthlyRecapWindow('2026-08-01')).toBe(true)
    expect(isMonthlyRecapWindow('2026-08-07')).toBe(true)
  })
  it('8일 이후는 노출 안 함', () => {
    expect(isMonthlyRecapWindow('2026-08-08')).toBe(false)
    expect(isMonthlyRecapWindow('2026-08-20')).toBe(false)
  })
})

describe('computeMonthlyRecap', () => {
  const walks: RecapWalk[] = [
    { duration_s: 600, distance_m: 800, dateKst: '2026-07-02' },
    { duration_s: 1200, distance_m: 1500, dateKst: '2026-07-10' },
  ]
  const records: RecapRecord[] = [
    { category: '식사', cost: null, event_on: '2026-07-02' },
    { category: '식사', cost: null, event_on: '2026-07-03' },
    { category: '배변', cost: null, event_on: '2026-07-03' },
    { category: '진료', cost: 45000, event_on: '2026-07-15' }, // 비용만(생활기록 아님)
  ]

  it('산책·생활기록·지출·함께한 날을 합산한다', () => {
    const r = computeMonthlyRecap(walks, records, 31)
    expect(r.walkCount).toBe(2)
    expect(r.distanceM).toBe(2300)
    expect(r.durationS).toBe(1800)
    expect(r.logCount).toBe(3) // 식사2+배변1 (진료는 생활기록 아님)
    expect(r.spend).toBe(45000)
    // 함께한 날: 07-02, 07-03, 07-10, 07-15 = 4일
    expect(r.activeDays).toBe(4)
    expect(r.daysInMonth).toBe(31)
  })

  it('가장 많이 남긴 생활기록 항목을 topCategory 로 준다(진료 등 비생활기록 제외)', () => {
    const r = computeMonthlyRecap(walks, records, 31)
    expect(r.topCategory).toEqual({ category: '식사', count: 2 })
  })

  it('생활기록이 없으면 topCategory 는 null', () => {
    const r = computeMonthlyRecap([], [{ category: '진료', cost: 30000, event_on: '2026-07-01' }], 31)
    expect(r.topCategory).toBeNull()
    expect(r.logCount).toBe(0)
    expect(r.spend).toBe(30000)
  })

  it('활동 유무 판정 — 전부 0이면 false', () => {
    expect(hasMonthlyRecapActivity(computeMonthlyRecap([], [], 31))).toBe(false)
    expect(hasMonthlyRecapActivity(computeMonthlyRecap(walks, [], 31))).toBe(true)
  })
})

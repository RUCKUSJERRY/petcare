import { describe, it, expect } from 'vitest'
import { nextOccurrence, activeNextDue, describeRule, parseYMD, ymd, type RecurRule } from './recurrence'

const next = (rule: RecurRule, base: string, after: string) => {
  const d = nextOccurrence(rule, parseYMD(base), parseYMD(after))
  return d ? ymd(d) : null
}

describe('nextOccurrence', () => {
  it('N일마다', () => {
    expect(next({ freq: 'day', interval: 3 }, '2025-06-01', '2025-06-01')).toBe('2025-06-04')
  })
  it('매주 월·수', () => {
    const r: RecurRule = { freq: 'week', interval: 1, byweekday: [1, 3] }
    expect(next(r, '2025-06-02', '2025-06-02')).toBe('2025-06-04') // 다음 수요일
    expect(next(r, '2025-06-02', '2025-06-04')).toBe('2025-06-09') // 다음 월요일
  })
  it('매월 1일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dom' }
    expect(next(r, '2025-01-01', '2025-01-15')).toBe('2025-02-01')
  })
  it('매월 첫째 주 월요일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dow', week: 1, weekday: 1 }
    expect(next(r, '2025-06-01', '2025-06-01')).toBe('2025-06-02') // 6월 첫 월요일
    expect(next(r, '2025-06-01', '2025-06-02')).toBe('2025-07-07') // 7월 첫 월요일
  })
  it('매월 마지막 주 금요일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dow', week: -1, weekday: 5 }
    expect(next(r, '2025-06-01', '2025-06-01')).toBe('2025-06-27') // 6월 마지막 금요일
  })
  it('매년', () => {
    const r: RecurRule = { freq: 'year', interval: 1 }
    expect(next(r, '2025-03-10', '2025-06-01')).toBe('2026-03-10')
  })
})

describe('activeNextDue', () => {
  it('반복이면 today 이후로 굴러간다', () => {
    const r = JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' })
    // 시작 2025-01-01, 저장된 next는 과거지만 오늘이 3/10이면 4/1로 굴림
    expect(activeNextDue('2025-01-01', r, '2025-02-01', '2025-03-10')).toBe('2025-04-01')
  })
  it('반복이 아니면 저장된 값을 그대로', () => {
    expect(activeNextDue('2025-01-01', null, '2025-02-01', '2025-03-10')).toBe('2025-02-01')
  })
})

describe('describeRule', () => {
  it('매월 1일', () => {
    expect(describeRule({ freq: 'month', interval: 1, mode: 'dom' }, '2025-06-01')).toBe('매월 1일')
  })
  it('매월 첫째 주 월요일', () => {
    expect(describeRule({ freq: 'month', interval: 1, mode: 'dow', week: 1, weekday: 1 }, '2025-06-02')).toBe('매월 첫째 주 월요일')
  })
  it('매주 월·수', () => {
    expect(describeRule({ freq: 'week', interval: 1, byweekday: [1, 3] }, '2025-06-02')).toBe('매주 월·수')
  })
})

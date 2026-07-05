import { describe, it, expect } from 'vitest'
import { getHoliday } from './holidays'

describe('getHoliday', () => {
  it('고정 공휴일을 반환한다', () => {
    expect(getHoliday('2026-01-01')).toBe('신정')
    expect(getHoliday('2026-06-06')).toBe('현충일')
    expect(getHoliday('2026-12-25')).toBe('성탄절')
  })
  it('음력·대체공휴일도 반영한다', () => {
    expect(getHoliday('2026-02-17')).toBe('설날')
    expect(getHoliday('2026-03-02')).toBe('대체공휴일')
    expect(getHoliday('2026-09-25')).toBe('추석')
  })
  it('공휴일이 아니면 null', () => {
    expect(getHoliday('2026-07-05')).toBeNull()
    expect(getHoliday('2026-11-11')).toBeNull()
  })
})

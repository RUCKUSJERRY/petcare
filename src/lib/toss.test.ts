import { describe, it, expect } from 'vitest'
import { addOneMonth } from './toss'

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('addOneMonth', () => {
  it('일반적인 날짜는 같은 일자로 1개월 뒤가 된다', () => {
    expect(ymd(addOneMonth(new Date(2026, 0, 15)))).toBe('2026-02-15') // 1/15 → 2/15
    expect(ymd(addOneMonth(new Date(2026, 5, 1)))).toBe('2026-07-01') // 6/1 → 7/1
  })

  it('말일은 다음 달 말일로 클램프된다 (setMonth 오버플로 방지)', () => {
    // 1/31 → (2/31 없음) → 2/28. 단순 setMonth는 3/2~3로 새어나간다.
    expect(ymd(addOneMonth(new Date(2026, 0, 31)))).toBe('2026-02-28')
    // 윤년(2024)에는 2/29 로 클램프
    expect(ymd(addOneMonth(new Date(2024, 0, 31)))).toBe('2024-02-29')
    // 3/31 → 4/30
    expect(ymd(addOneMonth(new Date(2026, 2, 31)))).toBe('2026-04-30')
  })

  it('12월은 다음 해 1월로 넘어간다', () => {
    expect(ymd(addOneMonth(new Date(2026, 11, 15)))).toBe('2027-01-15')
  })

  it('원본 Date를 변형하지 않는다', () => {
    const src = new Date(2026, 0, 31)
    addOneMonth(src)
    expect(ymd(src)).toBe('2026-01-31')
  })
})

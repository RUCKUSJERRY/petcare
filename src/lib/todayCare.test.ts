import { describe, it, expect } from 'vitest'
import { computeTodayCare, TODAY_CARE_ITEMS } from './todayCare'

describe('computeTodayCare', () => {
  it('아무것도 안 하면 전부 미완료', () => {
    const s = computeTodayCare([], false)
    expect(s.doneCount).toBe(0)
    expect(s.total).toBe(TODAY_CARE_ITEMS.length)
    expect(s.allDone).toBe(false)
    expect(s.items.every(i => !i.done)).toBe(true)
  })

  it('기록 카테고리로 해당 항목이 완료로 표시된다', () => {
    const s = computeTodayCare(['식사', '배변'], false)
    const done = new Set(s.items.filter(i => i.done).map(i => i.key))
    expect(done.has('meal')).toBe(true)
    expect(done.has('poop')).toBe(true)
    expect(done.has('water')).toBe(false)
    expect(done.has('walk')).toBe(false)
    expect(s.doneCount).toBe(2)
  })

  it('산책은 records 가 아니라 walkedToday 로 판정한다', () => {
    // 산책 카테고리를 기록에 넣어도(잘못된 신호) walk 항목은 walkedToday 로만 켜진다
    const notWalked = computeTodayCare(['식사'], false)
    expect(notWalked.items.find(i => i.key === 'walk')!.done).toBe(false)
    const walked = computeTodayCare(['식사'], true)
    expect(walked.items.find(i => i.key === 'walk')!.done).toBe(true)
  })

  it('중복 카테고리는 한 번으로 취급한다', () => {
    const s = computeTodayCare(['식사', '식사', '식사'], false)
    expect(s.items.find(i => i.key === 'meal')!.done).toBe(true)
    expect(s.doneCount).toBe(1)
  })

  it('전부 챙기면 allDone', () => {
    const s = computeTodayCare(['식사', '물', '배변'], true)
    expect(s.doneCount).toBe(4)
    expect(s.allDone).toBe(true)
  })

  it('Set 입력도 지원한다', () => {
    const s = computeTodayCare(new Set(['물']), false)
    expect(s.items.find(i => i.key === 'water')!.done).toBe(true)
    expect(s.doneCount).toBe(1)
  })
})

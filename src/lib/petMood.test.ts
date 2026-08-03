import { describe, expect, it } from 'vitest'
import { petMood } from './petMood'

describe('petMood', () => {
  it('연속일이 없으면 중립(기다림) 상태', () => {
    const m = petMood(0)
    expect(m.emoji).toBe('🐾')
    expect(m.ring).toBe('')
  })

  it('연속일이 길수록 더 신난 단계로 올라간다', () => {
    expect(petMood(1).emoji).toBe('🙂')
    expect(petMood(3).emoji).toBe('😄')
    expect(petMood(7).emoji).toBe('😆')
    expect(petMood(30).emoji).toBe('🤩')
  })

  it('각 구간 경계에서 단계가 바뀐다', () => {
    expect(petMood(2).emoji).toBe('🙂') // 3 미만
    expect(petMood(6).emoji).toBe('😄') // 7 미만
    expect(petMood(13).emoji).toBe('😆') // 14 미만
    expect(petMood(14).emoji).toBe('🤩')
  })

  it('연속일이 1 이상이면 테두리 강조가 있다', () => {
    expect(petMood(1).ring).not.toBe('')
    expect(petMood(10).ring).not.toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { petMood, petSpeech } from './petMood'

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

  it('오늘 돌봄을 모두 마치면 연속일이 짧아도 활짝(🥰) 웃는다', () => {
    expect(petMood(0, 4, 4).emoji).toBe('🥰')
    expect(petMood(1, 4, 4).emoji).toBe('🥰')
    // 긴 연속이어도 오늘 완료면 '오늘 완료' 표정을 우선한다
    expect(petMood(30, 4, 4).emoji).toBe('🥰')
    expect(petMood(0, 4, 4).ring).not.toBe('')
  })

  it('오늘 일부만 챙긴 연속 0일도 최소 기분 좋아요(🙂)로 올라간다', () => {
    expect(petMood(0, 1, 4).emoji).toBe('🙂')
    // 아직 아무것도 안 챙긴 연속 0일은 여전히 중립
    expect(petMood(0, 0, 4).emoji).toBe('🐾')
  })

  it('오늘 신호가 없으면(기본값) 기존 연속일 기반 동작과 동일하다', () => {
    expect(petMood(7)).toEqual(petMood(7, 0, 4))
  })
})

describe('petSpeech', () => {
  it('오늘 모두 완료면 감사/축하 대사', () => {
    expect(petSpeech(0, 4, 4)).toContain('고마워요')
    // 연속 3일 이상이면 연속을 강조
    expect(petSpeech(5, 4, 4)).toContain('5일째')
  })

  it('일부만 완료면 남은 개수를 알려주며 독려한다', () => {
    expect(petSpeech(2, 1, 4)).toContain('3가지')
  })

  it('오늘 시작 전이면 연속 상태에 따라 다른 기다림 대사', () => {
    expect(petSpeech(5, 0, 4)).toContain('5일째')
    expect(petSpeech(0, 0, 4)).toContain('첫 기록')
  })

  it('결정적이다 — 같은 입력엔 같은 대사', () => {
    expect(petSpeech(3, 2, 4)).toBe(petSpeech(3, 2, 4))
  })
})

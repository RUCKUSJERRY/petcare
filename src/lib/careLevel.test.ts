import { describe, expect, it } from 'vitest'
import { CARE_LEVELS, computeCareLevel, computeCarePoints } from './careLevel'

describe('computeCarePoints', () => {
  it('산책은 가중(3배)해 합산한다', () => {
    expect(computeCarePoints(10, 0)).toBe(10)
    expect(computeCarePoints(10, 2)).toBe(16) // 10 + 2*3
  })
  it('음수·소수는 방어적으로 보정', () => {
    expect(computeCarePoints(-5, -1)).toBe(0)
    expect(computeCarePoints(3.9, 1.9)).toBe(6) // floor(3)+floor(1)*3
  })
})

describe('computeCareLevel', () => {
  it('0포인트는 레벨1(첫 만남)', () => {
    const l = computeCareLevel(0)
    expect(l.level).toBe(1)
    expect(l.title).toBe('첫 만남')
    expect(l.nextThreshold).toBe(10)
    expect(l.progressPct).toBe(0)
  })

  it('구간 중간의 진행률을 계산한다', () => {
    // 레벨2(10)~레벨3(30) 구간에서 20포인트 → 절반
    const l = computeCareLevel(20)
    expect(l.level).toBe(2)
    expect(l.title).toBe('돌봄 새내기')
    expect(l.nextThreshold).toBe(30)
    expect(l.progressPct).toBe(50)
  })

  it('임계값 정확히 도달 시 다음 레벨로 승급', () => {
    const l = computeCareLevel(30)
    expect(l.level).toBe(3)
    expect(l.title).toBe('든든한 보호자')
  })

  it('최고 레벨은 nextThreshold=null, 진행률 100', () => {
    const top = CARE_LEVELS[CARE_LEVELS.length - 1]
    const l = computeCareLevel(top.threshold + 500)
    expect(l.level).toBe(CARE_LEVELS.length)
    expect(l.title).toBe(top.title)
    expect(l.nextThreshold).toBeNull()
    expect(l.progressPct).toBe(100)
  })
})

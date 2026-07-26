import { describe, expect, it } from 'vitest'
import { pickShareableAchievement, achievementCaption, STREAK_SHARE_MIN } from './achievement'

describe('pickShareableAchievement', () => {
  it('오늘 이정표가 최우선', () => {
    const a = pickShareableAchievement({ streak: 10, milestone: { milestone: 100, dday: 0 } })
    expect(a).toEqual({ kind: 'milestoneToday', icon: '🎉', headline: '함께한 지 100일!' })
  })
  it('이정표가 오늘이 아니면 연속 기록으로', () => {
    const a = pickShareableAchievement({ streak: 5, milestone: { milestone: 200, dday: 3 } })
    expect(a?.kind).toBe('streak')
    expect(a?.headline).toBe('5일 연속 기록 중')
  })
  it(`연속 ${STREAK_SHARE_MIN}일 미만이고 이정표 없으면 null`, () => {
    expect(pickShareableAchievement({ streak: STREAK_SHARE_MIN - 1, milestone: null })).toBeNull()
    expect(pickShareableAchievement({ streak: 0, milestone: null })).toBeNull()
  })
  it(`연속 정확히 ${STREAK_SHARE_MIN}일이면 공유 가능`, () => {
    expect(pickShareableAchievement({ streak: STREAK_SHARE_MIN, milestone: null })?.kind).toBe('streak')
  })
})

describe('achievementCaption', () => {
  it('이름이 있으면 접두로 붙인다', () => {
    expect(achievementCaption('콩이', '7일 연속 기록 중')).toBe('콩이 · 7일 연속 기록 중 🐾 펫케어에서 기록 중')
  })
  it('이름이 비면 접두 없이', () => {
    expect(achievementCaption('  ', '함께한 지 100일!')).toBe('함께한 지 100일! 🐾 펫케어에서 기록 중')
  })
})

import { describe, expect, it } from 'vitest'
import { badgeProgress, BADGE_DEFS, computeBadges } from './badges'

describe('computeBadges', () => {
  it('임계값 이상이면 획득, 미만이면 진행률 계산', () => {
    const badges = computeBadges({ recordCount: 50, walkCount: 0, togetherDays: null })
    const rec1 = badges.find(b => b.id === 'record-1')!
    const rec30 = badges.find(b => b.id === 'record-30')!
    const rec100 = badges.find(b => b.id === 'record-100')!
    expect(rec1.earned).toBe(true)
    expect(rec30.earned).toBe(true)
    expect(rec100.earned).toBe(false)
    expect(rec100.progressPct).toBe(50) // 50/100
  })

  it('산책 뱃지는 산책 수로 판정', () => {
    const badges = computeBadges({ recordCount: 0, walkCount: 10, togetherDays: null })
    expect(badges.find(b => b.id === 'walk-10')!.earned).toBe(true)
    expect(badges.find(b => b.id === 'walk-30')!.earned).toBe(false)
  })

  it('입양일 미상(togetherDays=null)이면 함께한 날 뱃지는 모두 미획득', () => {
    const badges = computeBadges({ recordCount: 0, walkCount: 0, togetherDays: null })
    const together = badges.filter(b => b.category === 'together')
    expect(together.every(b => !b.earned)).toBe(true)
    expect(together.every(b => b.current === 0)).toBe(true)
  })

  it('함께한 날수로 이정표 뱃지 획득', () => {
    const badges = computeBadges({ recordCount: 0, walkCount: 0, togetherDays: 365 })
    expect(badges.find(b => b.id === 'together-100')!.earned).toBe(true)
    expect(badges.find(b => b.id === 'together-365')!.earned).toBe(true)
    expect(badges.find(b => b.id === 'together-500')!.earned).toBe(false)
  })

  it('badgeProgress 는 획득/전체 수를 센다', () => {
    const badges = computeBadges({ recordCount: 1, walkCount: 1, togetherDays: null })
    const p = badgeProgress(badges)
    expect(p.total).toBe(BADGE_DEFS.length)
    expect(p.earned).toBe(2) // record-1 · walk-1
  })

  it('획득 직전(반올림하면 100%)에도 미획득이면 99%로 표시한다', () => {
    // 임계값 바로 아래(예: 함께한 날 364/365 = 99.7%) → 반올림 100%지만 아직 미획득이라
    // 막대가 가득 차면 안 된다(획득해야만 100%).
    const badges = computeBadges({ recordCount: 0, walkCount: 0, togetherDays: 364 })
    const b = badges.find(x => x.id === 'together-365')!
    expect(b.earned).toBe(false)
    expect(b.progressPct).toBe(99)
  })
})

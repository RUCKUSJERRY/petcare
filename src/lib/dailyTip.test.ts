import { describe, expect, it } from 'vitest'
import { getDailyTip, tipPool } from './dailyTip'

describe('dailyTip', () => {
  it('종별로 비어있지 않은 팁 풀을 만든다', () => {
    expect(tipPool('dog').length).toBeGreaterThan(0)
    expect(tipPool('cat').length).toBeGreaterThan(0)
  })

  it('고양이 풀은 고양이 전용 콘텐츠(수분·습식)를 포함한다', () => {
    const catTexts = tipPool('cat').map(t => t.text).join('\n')
    expect(catTexts).toContain('습식')
  })

  it('같은 날짜에는 항상 같은 팁을 고른다(결정적)', () => {
    const a = getDailyTip('dog', '2026-07-24')
    const b = getDailyTip('dog', '2026-07-24')
    expect(a).not.toBeNull()
    expect(a).toEqual(b)
  })

  it('날짜가 바뀌면 대체로 다른 팁으로 순환한다', () => {
    // 30일치 팁을 모으면 최소 2종류 이상은 나와야 한다(고정 팁 버그 방지).
    const seen = new Set<string>()
    for (let d = 1; d <= 30; d++) {
      const tip = getDailyTip('dog', `2026-01-${String(d).padStart(2, '0')}`)
      if (tip) seen.add(tip.text)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('고른 팁은 항상 유효한 가이드 링크를 가진다', () => {
    const tip = getDailyTip('dog', '2026-03-15')
    expect(tip).not.toBeNull()
    expect(['/care', '/foods']).toContain(tip!.href)
  })
})

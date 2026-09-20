import { describe, expect, it } from 'vitest'
import { seasonForMonth, seasonalCareFor } from './seasonalCare'

describe('seasonForMonth', () => {
  it('월을 기상학적 계절로 매핑한다', () => {
    expect(seasonForMonth(3)).toBe('spring')
    expect(seasonForMonth(4)).toBe('spring')
    expect(seasonForMonth(5)).toBe('spring')
    expect(seasonForMonth(6)).toBe('summer')
    expect(seasonForMonth(7)).toBe('summer')
    expect(seasonForMonth(8)).toBe('summer')
    expect(seasonForMonth(9)).toBe('autumn')
    expect(seasonForMonth(10)).toBe('autumn')
    expect(seasonForMonth(11)).toBe('autumn')
    expect(seasonForMonth(12)).toBe('winter')
    expect(seasonForMonth(1)).toBe('winter')
    expect(seasonForMonth(2)).toBe('winter')
  })

  it('경계값(2>3, 5>6, 8>9, 11>12)에서 계절이 정확히 전환된다', () => {
    expect(seasonForMonth(2)).not.toBe(seasonForMonth(3))
    expect(seasonForMonth(5)).not.toBe(seasonForMonth(6))
    expect(seasonForMonth(8)).not.toBe(seasonForMonth(9))
    expect(seasonForMonth(11)).not.toBe(seasonForMonth(12))
  })

  it('범위를 벗어난 월은 방어적으로 겨울로 폴백한다', () => {
    expect(seasonForMonth(0)).toBe('winter')
    expect(seasonForMonth(13)).toBe('winter')
  })
})

describe('seasonalCareFor', () => {
  it('계절·라벨·아이콘·포인트를 함께 반환한다', () => {
    const summer = seasonalCareFor('dog', 7)
    expect(summer.season).toBe('summer')
    expect(summer.label).toBe('여름')
    expect(summer.icon).toBeTruthy()
    expect(summer.points.length).toBeGreaterThan(0)
  })

  it('종별로 서로 다른 전용 포인트가 이어 붙는다', () => {
    const dog = seasonalCareFor('dog', 7).points
    const cat = seasonalCareFor('cat', 7).points
    // 공통 포인트는 두 종 모두 포함하되, 종별 포인트가 달라 전체 목록이 달라진다.
    expect(dog).not.toEqual(cat)
    // 강아지 여름엔 아스팔트 화상, 고양이 여름엔 음수량 포인트가 들어간다.
    expect(dog.join('\n')).toContain('아스팔트')
    expect(cat.join('\n')).toContain('음수량')
  })

  it('여름은 열사병, 겨울은 부동액 등 계절 특화 안전 정보를 담는다', () => {
    expect(seasonalCareFor('dog', 8).points.join('\n')).toContain('열사병')
    expect(seasonalCareFor('cat', 1).points.join('\n')).toContain('부동액')
  })

  it('모든 종·월 조합에서 비어있지 않은 포인트를 만든다(결정적)', () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonalCareFor('dog', m).points.length).toBeGreaterThan(0)
      expect(seasonalCareFor('cat', m).points.length).toBeGreaterThan(0)
    }
  })

  it('같은 입력에는 항상 같은 결과를 반환한다(순수 함수)', () => {
    expect(seasonalCareFor('cat', 4)).toEqual(seasonalCareFor('cat', 4))
  })
})

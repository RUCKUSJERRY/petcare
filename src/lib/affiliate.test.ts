import { describe, it, expect } from 'vitest'
import { getSmartRecommendations, MEAL_ROUTINE_MIN } from './affiliate'

describe('getSmartRecommendations', () => {
  it('임박한 케어 일정을 가까운 순으로 추천한다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [
        { species: 'dog', category: '미용', daysUntil: 10 },
        { species: 'dog', category: '양치', daysUntil: 2 },
      ],
    })
    expect(recs).toHaveLength(2)
    // 더 가까운 양치(D-2)가 먼저
    expect(recs[0].trigger).toEqual({ type: 'careDue', category: '양치', daysUntil: 2 })
    expect(recs[0].product.category).toBe('health')
    expect(recs[0].product.id).toContain('dental')
    expect(recs[1].trigger).toMatchObject({ category: '미용' })
    expect(recs[1].product.category).toBe('care')
  })

  it('종(species)에 맞는 상품을 고른다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [{ species: 'cat', category: '양치', daysUntil: 1 }],
    })
    expect(recs[0].product.species).toBe('cat')
  })

  it('처방이 필요한 카테고리(접종·심장사상충)는 추천하지 않는다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [
        { species: 'dog', category: '접종', daysUntil: 3 },
        { species: 'dog', category: '심장사상충', daysUntil: 5 },
      ],
    })
    expect(recs).toHaveLength(0)
  })

  it('꾸준한 식사 기록이면 사료 재구매를 추천한다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [],
      meal: { species: 'dog', logs7d: MEAL_ROUTINE_MIN },
    })
    expect(recs).toHaveLength(1)
    expect(recs[0].trigger).toEqual({ type: 'mealRoutine' })
    expect(recs[0].product.category).toBe('food')
    expect(recs[0].product.species).toBe('dog')
  })

  it('식사 기록이 기준 미만이면 사료를 추천하지 않는다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [],
      meal: { species: 'dog', logs7d: MEAL_ROUTINE_MIN - 1 },
    })
    expect(recs).toHaveLength(0)
  })

  it('최대 3개까지만, 같은 상품은 중복 없이 추천한다', () => {
    const recs = getSmartRecommendations({
      dueSoon: [
        { species: 'dog', category: '미용', daysUntil: 1 },
        { species: 'dog', category: '목욕', daysUntil: 2 }, // 같은 grooming 상품 → 중복 제거
        { species: 'dog', category: '발톱', daysUntil: 3 }, // 동일
        { species: 'dog', category: '양치', daysUntil: 4 },
        { species: 'dog', category: '건강검진', daysUntil: 5 },
      ],
      meal: { species: 'dog', logs7d: 7 },
    })
    expect(recs.length).toBeLessThanOrEqual(3)
    const ids = recs.map(r => r.product.id)
    expect(new Set(ids).size).toBe(ids.length) // 중복 없음
  })

  it('신호가 없으면 빈 배열', () => {
    expect(getSmartRecommendations({ dueSoon: [] })).toEqual([])
  })
})

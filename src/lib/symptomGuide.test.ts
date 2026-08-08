import { describe, expect, it } from 'vitest'
import { SYMPTOM_GUIDES, symptomGuidesForSpecies, symptomGuideMatches } from './symptomGuide'

describe('symptomGuidesForSpecies', () => {
  it('종 미지정 시 전체를 반환한다', () => {
    expect(symptomGuidesForSpecies(null)).toHaveLength(SYMPTOM_GUIDES.length)
  })

  it('강아지는 공통(both) + 강아지 전용만, 고양이 전용은 제외', () => {
    const dog = symptomGuidesForSpecies('dog')
    expect(dog.every(g => g.species === 'both' || g.species === 'dog')).toBe(true)
    expect(dog.some(g => g.id === 'cat-urinary')).toBe(false)
  })

  it('고양이는 고양이 전용(요로 폐색)을 포함한다', () => {
    const cat = symptomGuidesForSpecies('cat')
    expect(cat.some(g => g.id === 'cat-urinary')).toBe(true)
    expect(cat.every(g => g.species === 'both' || g.species === 'cat')).toBe(true)
  })
})

describe('symptomGuideMatches', () => {
  const vomit = SYMPTOM_GUIDES.find(g => g.id === 'vomiting')!

  it('빈 질의는 항상 매칭', () => {
    expect(symptomGuideMatches(vomit, '')).toBe(true)
  })

  it('제목·본문 텍스트로 검색된다', () => {
    expect(symptomGuideMatches(vomit, '구토')).toBe(true)
    expect(symptomGuideMatches(vomit, '가려움')).toBe(false)
  })
})

describe('데이터 정합성', () => {
  it('모든 항목이 필수 필드를 갖는다', () => {
    for (const g of SYMPTOM_GUIDES) {
      expect(g.id).toBeTruthy()
      expect(g.title).toBeTruthy()
      expect(g.watch.length).toBeGreaterThan(0)
      expect(g.redFlags.length).toBeGreaterThan(0)
      expect(g.vetWhen).toBeTruthy()
    }
  })

  it('id 는 중복되지 않는다', () => {
    const ids = SYMPTOM_GUIDES.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

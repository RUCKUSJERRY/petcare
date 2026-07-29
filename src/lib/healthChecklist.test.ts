import { describe, expect, it } from 'vitest'
import { healthChecklistFor } from './healthChecklist'

describe('healthChecklistFor', () => {
  it('종·단계에 맞는 체크리스트를 반환한다', () => {
    const puppy = healthChecklistFor('dog', '퍼피')
    expect(puppy.species).toBe('dog')
    expect(puppy.stage).toBe('퍼피')
    expect(puppy.items.length).toBeGreaterThan(0)

    const senior = healthChecklistFor('cat', '시니어')
    expect(senior.species).toBe('cat')
    expect(senior.stage).toBe('시니어')
    expect(senior.items.length).toBeGreaterThan(0)
  })

  it('나이 미상은 성체(성견/성묘)로 폴백', () => {
    expect(healthChecklistFor('dog', '미상').stage).toBe('성견')
    expect(healthChecklistFor('cat', '미상').stage).toBe('성묘')
  })

  it('종과 어긋난 단계(dog+키튼)는 성체로 폴백', () => {
    // 강아지에 고양이 단계가 들어와도 빈 자리채움이 새지 않고 성견으로 폴백
    expect(healthChecklistFor('dog', '키튼').stage).toBe('성견')
    expect(healthChecklistFor('cat', '퍼피').stage).toBe('성묘')
  })

  it('모든 유효 조합이 비어있지 않다', () => {
    for (const s of ['퍼피', '성견', '시니어'] as const) {
      expect(healthChecklistFor('dog', s).items.length).toBeGreaterThan(0)
    }
    for (const s of ['키튼', '성묘', '시니어'] as const) {
      expect(healthChecklistFor('cat', s).items.length).toBeGreaterThan(0)
    }
  })
})

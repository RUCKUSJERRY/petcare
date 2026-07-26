import { describe, expect, it } from 'vitest'
import { BCS_QUESTIONS, scoreBcs, bcsOutcome, type BcsSignal } from './bcs'

describe('scoreBcs', () => {
  it('모든 문항 응답 전에는 null', () => {
    expect(scoreBcs([])).toBeNull()
    expect(scoreBcs(['ideal'])).toBeNull()
    expect(scoreBcs(['ideal', 'ideal'])).toBeNull()
  })
  it('합계 ≤ -2 는 저체중', () => {
    expect(scoreBcs(['under', 'under', 'ideal'])).toBe('under') // -2
    expect(scoreBcs(['under', 'under', 'under'])).toBe('under') // -3
  })
  it('합계 ≥ +2 는 과체중', () => {
    expect(scoreBcs(['over', 'over', 'ideal'])).toBe('over') // +2
    expect(scoreBcs(['over', 'over', 'over'])).toBe('over') // +3
  })
  it('-1~+1 은 이상적', () => {
    expect(scoreBcs(['ideal', 'ideal', 'ideal'])).toBe('ideal') // 0
    expect(scoreBcs(['under', 'ideal', 'ideal'])).toBe('ideal') // -1
    expect(scoreBcs(['over', 'ideal', 'ideal'])).toBe('ideal') // +1
    expect(scoreBcs(['under', 'over', 'ideal'])).toBe('ideal') // 0 (상충)
    expect(scoreBcs(['under', 'over', 'over'])).toBe('ideal') // +1
  })
  it('문항 수(3개) 만큼 응답이 있어야 판정한다', () => {
    const signals: BcsSignal[] = BCS_QUESTIONS.map(() => 'ideal')
    expect(signals).toHaveLength(3)
    expect(scoreBcs(signals)).toBe('ideal')
  })
})

describe('bcsOutcome', () => {
  it('결과별 톤·제목·권장행동을 반환한다', () => {
    expect(bcsOutcome('under').tone).toBe('amber')
    expect(bcsOutcome('ideal').tone).toBe('green')
    expect(bcsOutcome('over').tone).toBe('red')
    for (const r of ['under', 'ideal', 'over'] as const) {
      const o = bcsOutcome(r)
      expect(o.result).toBe(r)
      expect(o.title.length).toBeGreaterThan(0)
      expect(o.actions.length).toBeGreaterThan(0)
    }
  })
})

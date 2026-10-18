import { describe, expect, it } from 'vitest'
import { alignRecords, nameSimilarity, recordSimilarity, scoreOcrCase } from './ocrScore'
import type { OcrEvalRecord } from './types'

describe('nameSimilarity', () => {
  it('동일 문자열은 1, 공백/대소문자 무시', () => {
    expect(nameSimilarity('종합백신 DHPPL', '종합백신 dhppl')).toBe(1)
  })
  it('둘 다 비면 1(둘 다 없음=일치), 한쪽만 비면 0', () => {
    expect(nameSimilarity('', '')).toBe(1)
    expect(nameSimilarity('광견병', '')).toBe(0)
  })
  it('부분 토큰 겹침은 0~1 Jaccard', () => {
    // {종합, 백신} vs {종합, 접종} → 교집합 1 / 합집합 3
    expect(nameSimilarity('종합 백신', '종합 접종')).toBeCloseTo(1 / 3, 6)
  })
})

describe('recordSimilarity', () => {
  it('날짜 일치가 가장 강한 신호(0.4)', () => {
    const a: OcrEvalRecord = { date: '2026-01-02', name: '' }
    const b: OcrEvalRecord = { date: '2026-01-02', name: '' }
    expect(recordSimilarity(a, b)).toBeCloseTo(0.4 + 0.3, 6) // 날짜0.4 + 빈이름일치0.3
  })
  it('날짜 둘 다 있고 다르면 날짜 가점 없음', () => {
    const a: OcrEvalRecord = { date: '2026-01-02', name: 'x' }
    const b: OcrEvalRecord = { date: '2026-09-09', name: 'x' }
    expect(recordSimilarity(a, b)).toBeCloseTo(0.3, 6) // 이름만 일치
  })
})

describe('alignRecords', () => {
  it('순서가 달라도 가장 잘 맞는 쌍끼리 매칭', () => {
    const gold: OcrEvalRecord[] = [
      { date: '2026-01-01', name: 'A' },
      { date: '2026-02-02', name: 'B' },
    ]
    const pred: OcrEvalRecord[] = [
      { date: '2026-02-02', name: 'B' },
      { date: '2026-01-01', name: 'A' },
    ]
    const { matches, missed, spurious } = alignRecords(gold, pred)
    expect(matches).toHaveLength(2)
    expect(missed).toHaveLength(0)
    expect(spurious).toHaveLength(0)
  })

  it('못 잡은 정답은 missed, 헛것은 spurious', () => {
    const gold: OcrEvalRecord[] = [{ date: '2026-01-01', name: 'A' }, { date: '2026-02-02', name: 'B' }]
    const pred: OcrEvalRecord[] = [{ date: '2026-01-01', name: 'A' }, { date: '2099-12-31', name: 'Z' }]
    const { matches, missed, spurious } = alignRecords(gold, pred)
    expect(matches).toHaveLength(1)
    expect(missed).toEqual([{ date: '2026-02-02', name: 'B' }])
    expect(spurious).toEqual([{ date: '2099-12-31', name: 'Z' }])
  })

  it('임계값 미만(완전 불일치)은 매칭하지 않음', () => {
    const gold: OcrEvalRecord[] = [{ date: '2026-01-01', name: 'A' }]
    const pred: OcrEvalRecord[] = [{ date: '2099-12-31', name: 'Z' }]
    expect(alignRecords(gold, pred).matches).toHaveLength(0)
  })
})

describe('scoreOcrCase', () => {
  const rec = (p: Partial<OcrEvalRecord>): OcrEvalRecord => ({ type: 'care', date: '2026-01-01', category: '접종', name: '종합백신', cost: 30000, ...p })

  it('완벽 예측이면 P=R=F1=1, 필드 전부 1', () => {
    const gold = [rec({})]
    const s = scoreOcrCase('c', gold, [rec({})])
    expect(s.precision).toBe(1)
    expect(s.recall).toBe(1)
    expect(s.f1).toBe(1)
    expect(s.fields).toEqual({ date: 1, type: 1, category: 1, cost: 1, name: 1 })
  })

  it('빈 gold + 빈 pred 는 완벽(1)', () => {
    const s = scoreOcrCase('c', [], [])
    expect(s.f1).toBe(1)
    expect(s.precision).toBe(1)
    expect(s.recall).toBe(1)
  })

  it('정답 2건 중 1건만 예측(헛것 없음): recall=0.5, precision=1', () => {
    const gold = [rec({ date: '2026-01-01' }), rec({ date: '2026-02-02', name: '광견병' })]
    const pred = [rec({ date: '2026-01-01' })]
    const s = scoreOcrCase('c', gold, pred)
    expect(s.recall).toBe(0.5)
    expect(s.precision).toBe(1)
    expect(s.f1).toBeCloseTo((2 * 1 * 0.5) / 1.5, 6)
  })

  it('정답 있는데 예측 0건: recall=0, f1=0', () => {
    const s = scoreOcrCase('c', [rec({})], [])
    expect(s.recall).toBe(0)
    expect(s.f1).toBe(0)
  })

  it('잡긴 했는데 금액·분류가 틀리면 필드 정확도에 반영(레코드 매칭은 날짜·이름으로 성립)', () => {
    const gold = [rec({ cost: 30000, category: '접종' })]
    const pred = [rec({ cost: 99999, category: '미용' })]
    const s = scoreOcrCase('c', gold, pred)
    expect(s.matched).toBe(1)        // 날짜+이름으로 매칭 성립
    expect(s.fields.cost).toBe(0)    // 금액 틀림
    expect(s.fields.category).toBe(0)
    expect(s.fields.date).toBe(1)
  })

  it('정답에 없는 필드는 정확도 분모에서 제외(해당없음=1)', () => {
    const gold = [{ date: '2026-01-01', name: 'A' }] // category·cost·type 없음
    const pred = [{ date: '2026-01-01', name: 'A' }]
    const s = scoreOcrCase('c', gold, pred)
    expect(s.fields.category).toBe(1)
    expect(s.fields.cost).toBe(1)
    expect(s.fields.type).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { scoreRetrieval, runRetrievalEval, toDocRanking, lexicalDocRetriever, type RetrievalDataset } from './evalRetrieval'
import { buildRagIndex } from './retriever'

describe('scoreRetrieval', () => {
  it('완벽: 관련 문서가 1위 → recall/precision@1 반영, mrr=1, ndcg=1', () => {
    const s = scoreRetrieval(['a', 'b', 'c'], ['a'], 3)
    expect(s.recall).toBe(1)
    expect(s.mrr).toBe(1)
    expect(s.ndcg).toBe(1)
    expect(s.precision).toBeCloseTo(1 / 3, 6)
  })

  it('관련 문서가 2위면 mrr=0.5, recall=1(k 안에 있음)', () => {
    const s = scoreRetrieval(['x', 'a'], ['a'], 5)
    expect(s.mrr).toBe(0.5)
    expect(s.recall).toBe(1)
  })

  it('k 밖이면 못 찾은 것(recall=0, mrr=0)', () => {
    const s = scoreRetrieval(['x', 'y', 'z', 'a'], ['a'], 3)
    expect(s.recall).toBe(0)
    expect(s.mrr).toBe(0)
    expect(s.ndcg).toBe(0)
  })

  it('관련 문서 2개 중 1개만 top-k → recall 0.5', () => {
    const s = scoreRetrieval(['a', 'x', 'y'], ['a', 'b'], 3)
    expect(s.recall).toBe(0.5)
    expect(s.foundInTopK).toBe(1)
  })

  it('관련 문서가 없으면(라벨 빈) recall/ndcg=1(해당없음)', () => {
    const s = scoreRetrieval(['a', 'b'], [], 3)
    expect(s.recall).toBe(1)
    expect(s.ndcg).toBe(1)
  })

  it('nDCG: 1위 관련이 2위 관련보다 높다', () => {
    const top = scoreRetrieval(['a', 'x'], ['a'], 5).ndcg
    const lower = scoreRetrieval(['x', 'a'], ['a'], 5).ndcg
    expect(top).toBeGreaterThan(lower)
  })
})

describe('toDocRanking', () => {
  it('청크 > 문서 id (중복 제거, 순서 유지)', () => {
    expect(toDocRanking([{ docId: 'a' }, { docId: 'a' }, { docId: 'b' }, { docId: 'a' }])).toEqual(['a', 'b'])
  })
})

describe('runRetrievalEval (lexical, 실 코퍼스)', () => {
  const dataset: RetrievalDataset = {
    name: 't', k: 5,
    cases: [
      { id: 'teeth', query: '강아지 양치 어떻게', relevantDocIds: ['care:teeth'] },
      { id: 'nails', query: '발톱 깎는 법', relevantDocIds: ['care:nails'] },
    ],
  }

  it('매크로 집계를 내고 recall 은 0~1', async () => {
    const index = buildRagIndex({ maxChars: 300 })
    const report = await runRetrievalEval(dataset, lexicalDocRetriever(index), 'lexical')
    expect(report.cases).toHaveLength(2)
    expect(report.macro.recall).toBeGreaterThanOrEqual(0)
    expect(report.macro.recall).toBeLessThanOrEqual(1)
    expect(report.label).toBe('lexical')
  })

  it('주입한 retriever 로 결정적으로 채점(가짜 retriever)', async () => {
    const fake = (q: string) => (q.includes('양치') ? ['care:teeth'] : ['care:nails'])
    const report = await runRetrievalEval(dataset, fake, 'fake')
    expect(report.macro.recall).toBe(1) // 둘 다 정확히 맞춤
    expect(report.macro.mrr).toBe(1)
  })
})

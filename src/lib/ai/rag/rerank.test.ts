import { describe, expect, it } from 'vitest'
import { buildRerankPrompt, parseRerankOrder, applyRerankOrder, makeRerankedDocRetriever } from './rerank'
import type { RagChunk } from './types'

const chunk = (id: string, title: string, text = ''): RagChunk => ({
  id, docId: id, source: 'care', title, text, href: '/care', metadata: {},
})

describe('buildRerankPrompt', () => {
  it('질의 + 0-based 번호 후보를 담는다', () => {
    const p = buildRerankPrompt('양치 방법', [chunk('a', '양치'), chunk('b', '목욕')])
    expect(p).toContain('양치 방법')
    expect(p).toContain('[0]')
    expect(p).toContain('[1]')
  })
})

describe('parseRerankOrder', () => {
  it('[2,0,1] 파싱', () => {
    expect(parseRerankOrder('[2,0,1]', 3)).toEqual([2, 0, 1])
  })
  it('{"order":[...]} 수용', () => {
    expect(parseRerankOrder('{"order":[1,0]}', 2)).toEqual([1, 0])
  })
  it('코드펜스/설명 섞여도 추출', () => {
    expect(parseRerankOrder('정렬 결과:\n```json\n[1,2,0]\n```', 3)).toEqual([1, 2, 0])
  })
  it('범위 밖·중복 제거하고 빠진 인덱스 보충 > 완전 순열', () => {
    expect(parseRerankOrder('[5,1,1,0]', 3)).toEqual([1, 0, 2])
  })
  it('파싱 불가면 원순서(0..n-1)', () => {
    expect(parseRerankOrder('모르겠어요', 3)).toEqual([0, 1, 2])
    expect(parseRerankOrder('', 2)).toEqual([0, 1])
  })
})

describe('applyRerankOrder', () => {
  it('순서대로 재배열', () => {
    const chunks = [chunk('a', 'A'), chunk('b', 'B'), chunk('c', 'C')]
    expect(applyRerankOrder(chunks, [2, 0, 1]).map(c => c.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('makeRerankedDocRetriever', () => {
  it('후보 검색 > 리랭커 재정렬 > 문서 순위(중복 제거)', async () => {
    const candidates = async () => [chunk('care:teeth#0', '양치'), chunk('care:bath#0', '목욕'), chunk('care:teeth#1', '양치2')]
    // 리랭커: 목욕을 맨 앞으로 올리는 가짜
    const reranker = async (_q: string, chunks: RagChunk[]) =>
      [...chunks].sort((a, b) => (a.docId === 'care:bath#0' ? -1 : 0) - (b.docId === 'care:bath#0' ? -1 : 0))
    const retrieve = makeRerankedDocRetriever(candidates, reranker)
    const docs = await retrieve('목욕')
    expect(docs[0]).toBe('care:bath#0')
    // care:teeth 는 청크가 2개여도 문서는 1번만
    expect(docs.filter(d => d === 'care:teeth#0')).toHaveLength(1)
  })

  it('리랭커가 원순서를 반환해도(실패 폴백) 동작', async () => {
    const candidates = async () => [chunk('a', 'A'), chunk('b', 'B')]
    const identity = async (_q: string, c: RagChunk[]) => c
    const docs = await makeRerankedDocRetriever(candidates, identity)('q')
    expect(docs).toEqual(['a', 'b'])
  })
})

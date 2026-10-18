import { describe, expect, it } from 'vitest'
import { tokenize, buildLexicalIndex, searchLexical } from './lexical'
import { cosineSim, searchVector, type EmbeddedChunk } from './vector'
import { reciprocalRankFusion } from './fuse'
import { buildRagIndex, RagIndex } from './retriever'
import type { RagChunk, Scored } from './types'

const chunk = (id: string, title: string, text: string): RagChunk => ({
  id, docId: id, source: 'care', title, text, href: '/care', metadata: {},
})

describe('tokenize', () => {
  it('한글 어절 + (길이≥3) bigram, 영문/숫자 소문자', () => {
    const toks = tokenize('양치질 ABC 123')
    expect(toks).toContain('양치질')
    expect(toks).toContain('양치') // bigram
    expect(toks).toContain('치질') // bigram
    expect(toks).toContain('abc')
    expect(toks).toContain('123')
  })
  it('길이 2 한글은 bigram 중복 없이 어절만', () => {
    expect(tokenize('양치').filter(t => t === '양치')).toHaveLength(1)
  })
})

describe('searchLexical (BM25)', () => {
  const chunks = [
    chunk('a', '양치', '매일 양치로 치석을 예방하세요 전용 치약 사용'),
    chunk('b', '목욕', '한 달에 한두 번 목욕으로 피부를 관리하세요'),
    chunk('c', '산책', '매일 산책으로 운동량을 채워주세요'),
  ]
  const idx = buildLexicalIndex(chunks)

  it('질의어가 든 청크를 상위로', () => {
    const res = searchLexical(idx, '치석 치약', 3)
    expect(res[0].item.id).toBe('a')
  })
  it('조사가 붙어도 bigram 으로 부분 매칭(치석이 ~ 치석)', () => {
    const res = searchLexical(buildLexicalIndex([chunk('x', '치아', '치석이 쌓이면 잇몸병')]), '치석', 3)
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].item.id).toBe('x')
  })
  it('안 맞는 질의는 빈 결과', () => {
    expect(searchLexical(idx, '자동차 보험', 3)).toEqual([])
  })
  it('빈 인덱스는 빈 결과', () => {
    expect(searchLexical(buildLexicalIndex([]), '양치', 3)).toEqual([])
  })
})

describe('cosineSim / searchVector', () => {
  it('같은 방향=1, 직교=0, 영벡터/길이불일치=0', () => {
    expect(cosineSim([1, 0], [2, 0])).toBeCloseTo(1, 6)
    expect(cosineSim([1, 0], [0, 1])).toBe(0)
    expect(cosineSim([0, 0], [1, 1])).toBe(0)
    expect(cosineSim([1], [1, 1])).toBe(0)
  })
  it('질의 벡터에 가까운 청크 상위', () => {
    const items: EmbeddedChunk[] = [
      { chunk: chunk('a', 'A', ''), embedding: [1, 0, 0] },
      { chunk: chunk('b', 'B', ''), embedding: [0, 1, 0] },
    ]
    const res = searchVector(items, [0.9, 0.1, 0], 2)
    expect(res[0].item.id).toBe('a')
  })
})

describe('reciprocalRankFusion', () => {
  it('두 랭킹 모두 상위인 항목이 가장 높게 융합', () => {
    const l1: Scored<{ id: string }>[] = [{ item: { id: 'x' }, score: 9 }, { item: { id: 'y' }, score: 8 }]
    const l2: Scored<{ id: string }>[] = [{ item: { id: 'x' }, score: 0.5 }, { item: { id: 'z' }, score: 0.4 }]
    const fused = reciprocalRankFusion([l1, l2], i => i.id, 3)
    expect(fused[0].item.id).toBe('x') // 두 리스트 모두 1위
  })
  it('빈 리스트들은 빈 결과', () => {
    expect(reciprocalRankFusion([[], []], (i: { id: string }) => i.id, 5)).toEqual([])
  })
})

describe('RagIndex (실 코퍼스)', () => {
  it('lexical: "치석 양치" 질의가 양치 가이드를 끌어온다', () => {
    const idx = buildRagIndex({ maxChars: 300 })
    const res = idx.searchLexical('강아지 치석 양치 어떻게', 5)
    expect(res.length).toBeGreaterThan(0)
    expect(res.some(r => r.item.docId === 'care:teeth')).toBe(true)
  })

  it('임베딩 없으면 hybrid 는 lexical 로 폴백', () => {
    const idx = buildRagIndex({ maxChars: 300 })
    const hybrid = idx.searchHybrid('치석 양치', null, 5)
    const lexical = idx.searchLexical('치석 양치', 5)
    expect(hybrid.map(r => r.item.id)).toEqual(lexical.map(r => r.item.id))
  })

  it('임베딩을 주입하면 hybrid 가 lexical+vector 를 RRF 로 합친다', () => {
    const chunks = [
      chunk('a', '양치', '치석 예방'),
      chunk('b', '구취', '입냄새가 심하면 치주질환 신호'),
    ]
    const idx = new RagIndex(chunks)
    // 'b' 를 질의 임베딩과 가깝게 설정 → vector 는 b 선호, lexical 은 a 선호 → 융합에 둘 다 등장
    idx.setEmbeddings(new Map([['a', [1, 0]], ['b', [0, 1]]]))
    const fused = idx.searchHybrid('치석', [0, 1], 2)
    const ids = fused.map(r => r.item.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })
})

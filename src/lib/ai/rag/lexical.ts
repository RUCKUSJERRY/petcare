import type { RagChunk, Scored } from './types'

/**
 * Lexical(키워드) 검색 — BM25. 하이브리드 검색의 '정확 일치' 축이며, 임베딩 없이 오프라인으로 동작한다.
 *
 * 한국어는 형태소 분석기 없이 어절만 쪼개면 조사가 붙어("치석이" vs "치석") 매칭을 놓친다. 분석기
 * 의존 없이 recall 을 올리려고, 한글 런(run)은 어절 전체 + 글자 2-그램(bigram)을 함께 토큰으로 쓴다.
 * (영문/숫자는 그대로.) 순수·결정적.
 */

/** 텍스트 > 토큰. 한글 런은 어절 + (길이≥3이면) 글자 bigram 을 추가. 영문·숫자는 소문자 그대로. */
export function tokenize(text: string): string[] {
  const out: string[] = []
  const runs = text.toLowerCase().match(/[가-힣]+|[a-z0-9]+/g) ?? []
  for (const r of runs) {
    out.push(r)
    if (/[가-힣]/.test(r) && r.length >= 3) {
      for (let i = 0; i + 2 <= r.length; i++) out.push(r.slice(i, i + 2))
    }
  }
  return out
}

interface Posting {
  /** 토큰 > 그 청크에서의 빈도 */
  tf: Map<string, number>
  len: number
}

export interface LexicalIndex {
  chunks: RagChunk[]
  postings: Posting[]
  df: Map<string, number>
  avgLen: number
  n: number
}

/** 청크들로 BM25 색인 구성. 제목 + 본문을 함께 토큰화한다. */
export function buildLexicalIndex(chunks: RagChunk[]): LexicalIndex {
  const postings: Posting[] = []
  const df = new Map<string, number>()
  let totalLen = 0
  for (const c of chunks) {
    const tokens = tokenize(`${c.title}\n${c.text}`)
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const t of Array.from(tf.keys())) df.set(t, (df.get(t) ?? 0) + 1)
    postings.push({ tf, len: tokens.length })
    totalLen += tokens.length
  }
  const n = chunks.length
  return { chunks, postings, df, avgLen: n > 0 ? totalLen / n : 0, n }
}

const K1 = 1.5
const B = 0.75

/** BM25 질의. 상위 topK 를 점수 내림차순으로. */
export function searchLexical(index: LexicalIndex, query: string, topK = 5): Scored<RagChunk>[] {
  if (index.n === 0) return []
  const qTerms = Array.from(new Set(tokenize(query)))
  const idf = (t: string) => {
    const nqt = index.df.get(t) ?? 0
    if (nqt === 0) return 0
    return Math.log(1 + (index.n - nqt + 0.5) / (nqt + 0.5))
  }
  const scored: Scored<RagChunk>[] = index.chunks.map((chunk, i) => {
    const p = index.postings[i]
    let score = 0
    for (const t of qTerms) {
      const f = p.tf.get(t)
      if (!f) continue
      const denom = f + K1 * (1 - B + (B * p.len) / (index.avgLen || 1))
      score += idf(t) * ((f * (K1 + 1)) / denom)
    }
    return { item: chunk, score }
  })
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, topK)
}

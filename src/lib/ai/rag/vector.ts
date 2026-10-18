import type { RagChunk, Scored } from './types'

/**
 * Vector(의미) 검색 — 코사인 유사도 kNN. 임베딩은 외부(모델)에서 받아 주입한다(이 파일은 순수).
 * 하이브리드의 '의미 일치' 축. 조사·표현이 달라도 뜻이 가까우면 잡는다.
 */

/** 코사인 유사도. 영벡터/길이 불일치는 0. */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** 임베딩이 달린 청크 */
export interface EmbeddedChunk {
  chunk: RagChunk
  embedding: number[]
}

/** 질의 임베딩과 가장 가까운 topK 청크(코사인 내림차순). */
export function searchVector(items: EmbeddedChunk[], queryEmbedding: number[], topK = 5): Scored<RagChunk>[] {
  return items
    .map(it => ({ item: it.chunk, score: cosineSim(queryEmbedding, it.embedding) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, topK)
}

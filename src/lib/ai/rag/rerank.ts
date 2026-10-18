import { generateText } from 'ai'
import { buildModel, specsFromEnv, type ModelSpec } from '../models/registry'
import { selectModel } from '../models/routing'
import { toDocRanking, type DocRetriever } from './evalRetrieval'
import type { RagChunk } from './types'

/**
 * 리랭킹 — 1차 검색(하이브리드) 상위 후보를 LLM 으로 '질의 적합도' 기준 재정렬한다.
 *
 * 1차 검색(BM25·벡터)은 빠르지만 거칠다. 상위 N개만 LLM 에 보여주고 "질문에 답하는 데 유용한 순서"로
 * 다시 세우면 정밀도가 오른다(cross-encoder 리랭킹의 LLM 판). 프롬프트 작성·응답 파싱은 순수로 두고
 * 네트워크는 얇게. 실패하면 원래 순서를 보존한다(검색을 깨지 않음).
 */

export type Reranker = (query: string, chunks: RagChunk[]) => Promise<RagChunk[]>

/** 리랭킹 프롬프트(순수). 후보를 0-based 번호로 제시하고, 적합도 내림차순 인덱스 배열(JSON)만 요청. */
export function buildRerankPrompt(query: string, chunks: RagChunk[]): string {
  const items = chunks.map((c, i) => {
    const snippet = `${c.title} — ${c.text.replace(/\n/g, ' ')}`.slice(0, 160)
    return `[${i}] ${snippet}`
  })
  return [
    `질문: ${query}`,
    '',
    '아래 문서 조각들을, 질문에 답하는 데 유용한 순서(가장 관련 높은 것 먼저)로 재정렬해.',
    '설명 없이 인덱스 번호만 JSON 배열로 출력해. 예: [2,0,1]',
    '',
    ...items,
  ].join('\n')
}

/**
 * 모델 응답에서 순서(인덱스 배열)를 관대하게 파싱(순수).
 * - [2,0,1] 또는 {"order":[2,0,1]} 수용. 코드펜스·설명 섞여도 첫 JSON 배열 추출.
 * - [0,n) 범위 밖·중복 제거, 빠진 인덱스는 원래 순서로 뒤에 보충 → 항상 길이 n 의 완전 순열.
 */
export function parseRerankOrder(content: string | undefined | null, n: number): number[] {
  const fallback = Array.from({ length: n }, (_, i) => i)
  if (!content) return fallback
  let raw = content.trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const arrStart = raw.indexOf('[')
  const arrEnd = raw.lastIndexOf(']')
  if (arrStart === -1 || arrEnd <= arrStart) {
    // {"order":[...]} 형태 시도
    try {
      const obj = JSON.parse(raw)
      if (Array.isArray(obj?.order)) return normalizeOrder(obj.order, n)
    } catch { /* noop */ }
    return fallback
  }
  try {
    const arr = JSON.parse(raw.slice(arrStart, arrEnd + 1))
    return Array.isArray(arr) ? normalizeOrder(arr, n) : fallback
  } catch {
    return fallback
  }
}

function normalizeOrder(arr: unknown[], n: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const v of arr) {
    const i = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) { seen.add(i); out.push(i) }
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i) // 빠진 것 보충
  return out
}

/** 순서대로 청크 재배열(순수). */
export function applyRerankOrder(chunks: RagChunk[], order: number[]): RagChunk[] {
  return order.filter(i => i >= 0 && i < chunks.length).map(i => chunks[i])
}

/** LLM 리랭커. 상위 maxCandidates 개만 재정렬. 실패 시 원순서 유지. */
export function makeLlmReranker(spec: ModelSpec, maxCandidates = 10): Reranker {
  const model = buildModel(spec)
  return async (query, chunks) => {
    const cand = chunks.slice(0, maxCandidates)
    const rest = chunks.slice(maxCandidates)
    if (cand.length <= 1) return chunks
    try {
      const { text } = await generateText({ model, prompt: buildRerankPrompt(query, cand), temperature: 0 })
      const order = parseRerankOrder(text, cand.length)
      return [...applyRerankOrder(cand, order), ...rest]
    } catch {
      return chunks
    }
  }
}

/** 구성된 모델로 기본 리랭커를 만든다(classify 작업 선호 = 싸고 빠른 쪽). 없으면 null. */
export function getDefaultReranker(): Reranker | null {
  const spec = selectModel('classify', specsFromEnv())
  return spec ? makeLlmReranker(spec) : null
}

/** 후보 청크 검색 > 리랭킹 > 문서 순위. (candidates 는 보통 hybridChunkRetriever) */
export function makeRerankedDocRetriever(
  candidates: (query: string) => Promise<RagChunk[]>,
  reranker: Reranker,
): DocRetriever {
  return async (query: string) => {
    const chunks = await candidates(query)
    const reranked = await reranker(query, chunks)
    return toDocRanking(reranked)
  }
}

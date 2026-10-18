import type { RagIndex } from './retriever'

/**
 * 검색 품질 Eval — recall@k / precision@k / MRR / nDCG@k (순수·결정적).
 *
 * "lexical 만으로 충분한가, vector/하이브리드/리랭킹이 실제로 더 잘 찾나"를 숫자로 답하기 위한 틀.
 * 라벨(질의 > 관련 문서 id)만 있으면 어떤 retriever 든 같은 잣대로 비교한다 — Eval 하네스(채점)의
 * 검색판.
 */

export interface RetrievalCase {
  id: string
  query: string
  /** 이 질의에 관련 있다고 라벨된 문서 id들(docId, 예: 'care:teeth') */
  relevantDocIds: string[]
}

export interface RetrievalDataset {
  name: string
  k: number
  cases: RetrievalCase[]
}

export interface RetrievalMetrics {
  recall: number
  precision: number
  mrr: number
  ndcg: number
}

export interface RetrievalCaseScore extends RetrievalMetrics {
  id: string
  relevant: number
  foundInTopK: number
}

export interface RetrievalReport {
  dataset: string
  k: number
  label: string
  cases: RetrievalCaseScore[]
  macro: RetrievalMetrics
}

/** 질의 > 순위가 매겨진 문서 id 목록(중복 제거). */
export type DocRetriever = (query: string) => string[] | Promise<string[]>

/** 한 질의의 검색 점수(이진 관련도). rankedDocIds 는 중복 없는 순위 목록 전제. */
export function scoreRetrieval(rankedDocIds: string[], relevantDocIds: string[], k: number): RetrievalCaseScore {
  const relevant = new Set(relevantDocIds)
  const topK = rankedDocIds.slice(0, k)
  const relCount = relevant.size

  let foundInTopK = 0
  let dcg = 0
  let firstRelRank = 0
  topK.forEach((id, i) => {
    if (relevant.has(id)) {
      foundInTopK++
      dcg += 1 / Math.log2(i + 2) // rel=1
      if (firstRelRank === 0) firstRelRank = i + 1
    }
  })
  // IDCG: 관련 문서를 top 에 이상적으로 배치했을 때(min(relCount,k)개)
  const idealN = Math.min(relCount, k)
  let idcg = 0
  for (let i = 0; i < idealN; i++) idcg += 1 / Math.log2(i + 2)

  return {
    id: '',
    relevant: relCount,
    foundInTopK,
    recall: relCount > 0 ? foundInTopK / relCount : 1,
    precision: k > 0 ? foundInTopK / k : 0,
    mrr: firstRelRank > 0 ? 1 / firstRelRank : 0,
    ndcg: idcg > 0 ? dcg / idcg : relCount === 0 ? 1 : 0,
  }
}

const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/** 데이터셋을 retriever 로 돌려 케이스별 + 매크로 집계. */
export async function runRetrievalEval(
  dataset: RetrievalDataset,
  retrieve: DocRetriever,
  label: string,
): Promise<RetrievalReport> {
  const cases: RetrievalCaseScore[] = []
  for (const c of dataset.cases) {
    const ranked = await retrieve(c.query)
    const s = scoreRetrieval(ranked, c.relevantDocIds, dataset.k)
    cases.push({ ...s, id: c.id })
  }
  return {
    dataset: dataset.name,
    k: dataset.k,
    label,
    cases,
    macro: {
      recall: mean(cases.map(c => c.recall)),
      precision: mean(cases.map(c => c.precision)),
      mrr: mean(cases.map(c => c.mrr)),
      ndcg: mean(cases.map(c => c.ndcg)),
    },
  }
}

/** 검색 결과(청크)를 문서 id 순위로 변환(중복 제거, 순서 유지). */
export function toDocRanking(chunks: { docId: string }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of chunks) {
    if (!seen.has(c.docId)) { seen.add(c.docId); out.push(c.docId) }
  }
  return out
}

/** RagIndex 의 lexical 검색을 DocRetriever 로. (충분히 넓게 뽑아 문서 단위로 축약) */
export function lexicalDocRetriever(index: RagIndex, pool = 30): DocRetriever {
  return (query: string) => toDocRanking(index.searchLexical(query, pool).map(s => s.item))
}

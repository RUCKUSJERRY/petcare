import type { Scored } from './types'

/**
 * 하이브리드 융합 — Reciprocal Rank Fusion(RRF).
 *
 * lexical·vector 는 점수 척도가 서로 달라 더하기 어렵다. RRF 는 '점수'가 아니라 '순위'만 써서
 * score = sum_lists 1/(k + rank) 로 합친다(rank 는 1부터). 척도에 무관하고 구현이 단순해 하이브리드
 * 검색의 표준 기법. 순수·결정적.
 */

const RRF_K = 60

/**
 * 여러 랭킹을 RRF 로 합친다.
 * @param lists 각 검색기의 결과(점수 내림차순 정렬 전제)
 * @param idOf 항목의 고유 id 추출
 * @param topK 반환 개수
 * @param k RRF 상수(기본 60) — 클수록 상위 순위 가중이 완만
 */
export function reciprocalRankFusion<T>(
  lists: Scored<T>[][],
  idOf: (item: T) => string,
  topK = 5,
  k: number = RRF_K,
): Scored<T>[] {
  const acc = new Map<string, { item: T; score: number }>()
  for (const list of lists) {
    list.forEach((s, idx) => {
      const id = idOf(s.item)
      const add = 1 / (k + idx + 1) // rank = idx+1
      const cur = acc.get(id)
      if (cur) cur.score += add
      else acc.set(id, { item: s.item, score: add })
    })
  }
  return Array.from(acc.values())
    .sort((a, b) => b.score - a.score || idOf(a.item).localeCompare(idOf(b.item)))
    .slice(0, topK)
}

import type { FieldAccuracy, OcrCaseScore, OcrEvalRecord } from './types'

/**
 * OCR 구조화추출 채점기 (순수·결정적).
 *
 * 추출은 '레코드 배열'을 내므로, 예측과 정답을 레코드 단위로 정렬(align)한 뒤 두 층위로 채점한다.
 * 1) 레코드 단위 정밀도/재현율/F1 — 맞는 건을 얼마나 잡고(recall) 헛걸 얼마나 안 냈나(precision).
 * 2) 매칭된 쌍의 필드별 정확도 — 잡은 레코드에서 날짜·분류·금액 등을 얼마나 정확히 읽었나.
 *
 * 정렬은 greedy: 모든 (gold, pred) 쌍의 유사도를 구해 높은 순으로 1:1 매칭(임계값 이상만).
 * 날짜 일치를 가장 강한 신호로, 이름 유사도·종류·금액을 보조 신호로 쓴다.
 */

const MATCH_THRESHOLD = 0.3

const normStr = (s: string | undefined): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** 이름/업체명 유사도 — 공백 토큰 Jaccard(0~1). 빈 값끼리는 1(둘 다 없음=일치로 봄). */
export function nameSimilarity(a: string | undefined, b: string | undefined): number {
  const na = normStr(a)
  const nb = normStr(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  if (na === nb) return 1
  // Set 직접 순회는 tsconfig target 상 다운레벨 이터레이션이 필요하므로, 고유 토큰은 배열로 다룬다.
  const ta = Array.from(new Set(na.split(' ')))
  const tb = new Set(nb.split(' '))
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.length + tb.size - inter
  return union > 0 ? inter / union : 0
}

/** 두 레코드의 매칭 유사도(0~1). 날짜 0.4 + 종류 0.2 + 이름 0.3 + 금액 0.1 가중합. */
export function recordSimilarity(gold: OcrEvalRecord, pred: OcrEvalRecord): number {
  let s = 0
  // 날짜: 둘 다 있고 같으면 가점, 둘 다 있는데 다르면 0(강한 불일치 신호), 한쪽만 없으면 중립
  if (gold.date && pred.date) s += gold.date === pred.date ? 0.4 : 0
  if (normStr(gold.type) && normStr(gold.type) === normStr(pred.type)) s += 0.2
  s += 0.3 * nameSimilarity(gold.name, pred.name)
  if (gold.cost != null && pred.cost != null && gold.cost === pred.cost) s += 0.1
  return s
}

export interface Alignment {
  matches: { gold: OcrEvalRecord; pred: OcrEvalRecord; sim: number }[]
  missed: OcrEvalRecord[]   // 정답에 있으나 못 잡음(FN)
  spurious: OcrEvalRecord[] // 예측에 있으나 정답에 없음(FP)
}

/** greedy 1:1 정렬. 임계값 미만 쌍은 매칭하지 않는다. */
export function alignRecords(gold: OcrEvalRecord[], pred: OcrEvalRecord[]): Alignment {
  const pairs: { gi: number; pi: number; sim: number }[] = []
  for (let gi = 0; gi < gold.length; gi++) {
    for (let pi = 0; pi < pred.length; pi++) {
      const sim = recordSimilarity(gold[gi], pred[pi])
      if (sim >= MATCH_THRESHOLD) pairs.push({ gi, pi, sim })
    }
  }
  // 동점은 결정적으로: 유사도 내림차순, 그다음 gold·pred 인덱스 오름차순
  pairs.sort((a, b) => b.sim - a.sim || a.gi - b.gi || a.pi - b.pi)
  const usedG = new Set<number>()
  const usedP = new Set<number>()
  const matches: Alignment['matches'] = []
  for (const p of pairs) {
    if (usedG.has(p.gi) || usedP.has(p.pi)) continue
    usedG.add(p.gi)
    usedP.add(p.pi)
    matches.push({ gold: gold[p.gi], pred: pred[p.pi], sim: p.sim })
  }
  const missed = gold.filter((_, gi) => !usedG.has(gi))
  const spurious = pred.filter((_, pi) => !usedP.has(pi))
  return { matches, missed, spurious }
}

/** 매칭된 쌍들의 필드별 정확도. 분모는 '정답에 그 필드가 있는 쌍' 수(없으면 1=해당없음 만점). */
function fieldAccuracy(matches: Alignment['matches']): FieldAccuracy {
  const acc = (has: (g: OcrEvalRecord) => boolean, ok: (g: OcrEvalRecord, p: OcrEvalRecord) => boolean): number => {
    const rel = matches.filter(m => has(m.gold))
    if (rel.length === 0) return 1
    return rel.filter(m => ok(m.gold, m.pred)).length / rel.length
  }
  return {
    date: acc(g => !!g.date, (g, p) => g.date === p.date),
    type: acc(g => !!normStr(g.type), (g, p) => normStr(g.type) === normStr(p.type)),
    category: acc(g => !!normStr(g.category), (g, p) => normStr(g.category) === normStr(p.category)),
    cost: acc(g => g.cost != null, (g, p) => g.cost === p.cost),
    // 이름은 유사도 0.6 이상이면 맞춘 것으로 본다(표기 흔들림 허용)
    name: acc(g => !!normStr(g.name), (g, p) => nameSimilarity(g.name, p.name) >= 0.6),
  }
}

/** 케이스 1건 채점: 레코드 P/R/F1 + 필드 정확도. */
export function scoreOcrCase(id: string, gold: OcrEvalRecord[], pred: OcrEvalRecord[]): OcrCaseScore {
  const { matches } = alignRecords(gold, pred)
  const matched = matches.length
  // 분모 0 처리: 예측이 없으면 정밀도 1(헛것 없음), 정답이 없으면 재현율 1(놓칠 것 없음)
  const precision = pred.length > 0 ? matched / pred.length : 1
  const recall = gold.length > 0 ? matched / gold.length : 1
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  return {
    id,
    goldCount: gold.length,
    predCount: pred.length,
    matched,
    precision,
    recall,
    f1,
    fields: fieldAccuracy(matches),
  }
}

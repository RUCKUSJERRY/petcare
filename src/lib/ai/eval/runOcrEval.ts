import type { FieldAccuracy, OcrCaseScore, OcrEvalCase, OcrEvalDataset, OcrEvalReport, OcrPredictor } from './types'
import { scoreOcrCase } from './ocrScore'

/** 케이스별 점수를 매크로 평균(케이스 단위 단순 평균)으로 집계. */
export function aggregateReport(dataset: string, cases: OcrCaseScore[]): OcrEvalReport {
  const n = cases.length
  const mean = (pick: (c: OcrCaseScore) => number) => (n > 0 ? cases.reduce((s, c) => s + pick(c), 0) / n : 0)
  const meanField = (pick: (f: FieldAccuracy) => number) => (n > 0 ? cases.reduce((s, c) => s + pick(c.fields), 0) / n : 0)
  return {
    dataset,
    cases,
    macro: {
      precision: mean(c => c.precision),
      recall: mean(c => c.recall),
      f1: mean(c => c.f1),
      fields: {
        date: meanField(f => f.date),
        type: meanField(f => f.type),
        category: meanField(f => f.category),
        cost: meanField(f => f.cost),
        name: meanField(f => f.name),
      },
    },
  }
}

/**
 * 데이터셋을 예측기(predict)로 돌려 채점 리포트를 낸다. predict 만 바꿔 끼우면
 * 오프라인(fixture 재생)·온라인(실모델) 어느 쪽도 같은 채점으로 비교된다.
 */
export async function runOcrEval(dataset: OcrEvalDataset, predict: OcrPredictor): Promise<OcrEvalReport> {
  const scores: OcrCaseScore[] = []
  for (const c of dataset.cases) {
    const pred = await predict(c.input, c)
    scores.push(scoreOcrCase(c.id, c.gold, pred))
  }
  return aggregateReport(dataset.name, scores)
}

/**
 * 오프라인 예측기: 케이스에 저장된 fixturePrediction 을 재생한다(네트워크 없이 결정적).
 * fixture 가 없는 케이스는 빈 예측으로 본다(평가에서 전부 놓친 것으로 집계 — 누락을 숨기지 않음).
 */
export const fixturePredictor: OcrPredictor = async (_input: string, c: OcrEvalCase) => c.fixturePrediction ?? []

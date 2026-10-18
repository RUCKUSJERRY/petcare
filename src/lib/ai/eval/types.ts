/**
 * LLM Eval(평가) 공통 타입.
 *
 * OCR 구조화추출을 첫 평가 대상으로 삼는다 — 정답(gold)을 만들기 쉽고(영수증/증명서의 날짜·금액·분류),
 * 채점이 결정적이라 "모델/프롬프트를 바꾸면 더 나아졌나"를 숫자로 판정할 수 있다.
 *
 * 설계: 데이터셋(입력+정답)과 채점기(순수)를 고정하고, '예측기(predict)'만 바꿔 끼운다.
 * - 오프라인: 케이스에 저장한 fixturePrediction 을 재생(네트워크 없이 CI 에서 결정적으로 돈다).
 * - 온라인: 실제 provider(Upstage/Gemini 등)로 추출해 비교(멀티모델 단계에서 F1·비용 함께 비교).
 */

/** 채점 대상이 되는 OCR 레코드(핵심 필드만 — 추출 정확도 평가용) */
export interface OcrEvalRecord {
  /** 'medical' | 'care' */
  type?: string
  /** 시행/진료일 YYYY-MM-DD */
  date?: string
  /** 병원/업체명 */
  clinic?: string
  /** care 분류(접종/구충 등) */
  category?: string
  /** 항목명/백신명/진단명 */
  name?: string
  /** 금액(원) */
  cost?: number
}

/** 평가 케이스 1건 */
export interface OcrEvalCase {
  id: string
  /** 사람이 읽을 설명(무엇을 검증하는 케이스인지) */
  description?: string
  /** 추출 입력(문서를 구조화한 텍스트 — Document Parse 결과를 흉내낸 합성 텍스트) */
  input: string
  /** 정답 레코드들 */
  gold: OcrEvalRecord[]
  /** 오프라인 결정적 평가용으로 저장해 둔 예측(특정 모델/시점 스냅샷). 없으면 온라인 예측 필요. */
  fixturePrediction?: OcrEvalRecord[]
}

export interface OcrEvalDataset {
  name: string
  cases: OcrEvalCase[]
}

/** 필드별 정확도(매칭된 레코드쌍 기준, 0~1) */
export interface FieldAccuracy {
  date: number
  type: number
  category: number
  cost: number
  name: number
}

/** 케이스 1건 채점 결과 */
export interface OcrCaseScore {
  id: string
  goldCount: number
  predCount: number
  matched: number
  /** 레코드 단위 정밀도/재현율/F1 (0~1) */
  precision: number
  recall: number
  f1: number
  /** 매칭쌍 기준 필드별 정확도 */
  fields: FieldAccuracy
}

/** 데이터셋 전체 집계(케이스 평균 = 매크로 평균) */
export interface OcrEvalReport {
  dataset: string
  cases: OcrCaseScore[]
  macro: {
    precision: number
    recall: number
    f1: number
    fields: FieldAccuracy
  }
}

/** 예측기: 입력 텍스트 → 추출 레코드들. 오프라인(fixture)·온라인(실모델) 모두 이 형태로 끼운다. */
export type OcrPredictor = (input: string, caseItem: OcrEvalCase) => Promise<OcrEvalRecord[]>

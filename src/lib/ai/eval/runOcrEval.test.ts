import { describe, expect, it } from 'vitest'
import { fixturePredictor, runOcrEval } from './runOcrEval'
import type { OcrEvalDataset } from './types'
import datasetJson from './dataset/ocr.json'

const dataset = datasetJson as unknown as OcrEvalDataset

describe('runOcrEval (fixture predictor, 결정적)', () => {
  it('데이터셋 전체를 돌려 케이스별 + 매크로 점수를 낸다', async () => {
    const report = await runOcrEval(dataset, fixturePredictor)
    expect(report.dataset).toBe('ocr-vet-ko-v1')
    expect(report.cases).toHaveLength(dataset.cases.length)
  })

  it('케이스별 점수가 설계한 시나리오와 일치', async () => {
    const report = await runOcrEval(dataset, fixturePredictor)
    const by = Object.fromEntries(report.cases.map(c => [c.id, c]))

    // 완벽 추출
    expect(by['receipt-single-vaccine'].f1).toBe(1)
    // 3건 중 2건만 예측 → recall 2/3, precision 1
    expect(by['vaccine-cert-multi'].recall).toBeCloseTo(2 / 3, 6)
    expect(by['vaccine-cert-multi'].precision).toBe(1)
    // 레코드는 맞췄지만 금액 오독 → 필드 cost 0, 레코드 F1 은 1
    expect(by['medical-visit-wrong-cost'].f1).toBe(1)
    expect(by['medical-visit-wrong-cost'].fields.cost).toBe(0)
    // 헛것 1건 추가 → precision 2/3, recall 1
    expect(by['mixed-with-spurious'].precision).toBeCloseTo(2 / 3, 6)
    expect(by['mixed-with-spurious'].recall).toBe(1)
    // 빈 정답 + 빈 예측 → 완벽
    expect(by['no-record'].f1).toBe(1)
  })

  it('매크로 집계(케이스 평균)', async () => {
    const report = await runOcrEval(dataset, fixturePredictor)
    // f1: (1 + 0.8 + 1 + 0.8 + 1)/5 = 0.92
    expect(report.macro.f1).toBeCloseTo(0.92, 6)
    // cost 필드 정확도: (1 + 1 + 0 + 1 + 1)/5 = 0.8
    expect(report.macro.fields.cost).toBeCloseTo(0.8, 6)
    expect(report.macro.fields.date).toBeCloseTo(1, 6)
    expect(report.macro.precision).toBeCloseTo(14 / 15, 6)
    expect(report.macro.recall).toBeCloseTo(14 / 15, 6)
  })

  it('빈 예측기(모두 놓침)면 recall 0 으로 떨어진다(누락을 숨기지 않음)', async () => {
    const emptyPredictor = async () => []
    const report = await runOcrEval(dataset, emptyPredictor)
    // gold 가 있는 케이스는 recall 0, 빈 gold 케이스(no-record)만 recall 1
    const noRecord = report.cases.find(c => c.id === 'no-record')!
    expect(noRecord.recall).toBe(1)
    const withGold = report.cases.filter(c => c.goldCount > 0)
    for (const c of withGold) expect(c.recall).toBe(0)
  })
})

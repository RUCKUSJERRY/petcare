import { generateText } from 'ai'
import type { ModelSpec } from '../models/registry'
import { buildModel } from '../models/registry'
import { estimateCostUsd, priceFor } from '../cost'
import { normalizeUsage } from '../usage'
import type { OcrEvalRecord, OcrPredictor } from './types'

/**
 * 라이브 Eval 예측기 — 실제 모델로 OCR 추출을 돌려 데이터셋을 채점한다.
 *
 * 이 파일이 세 축(옵저버빌리티·Eval·멀티모델)을 하나로 합친다: 같은 데이터셋을 구성된 각 모델로
 * 추출(멀티모델) > 채점기로 F1 산출(Eval) > usage x 단가로 비용 산출(옵저버빌리티). "싼 모델로
 * 바꿔도 품질이 유지되나"를 숫자로 답하기 위한 것.
 *
 * 순수부(프롬프트 작성·응답 파싱·비용 집계)는 테스트로 고정하고, 실제 네트워크 호출은
 * makeLivePredictor 안에 얇게 둔다(키·네트워크가 있어야 돈다).
 */

/** 추출 프롬프트(순수). 데이터셋 gold 와 같은 필드명으로 JSON 만 출력하도록 지시. */
export function buildExtractPrompt(input: string): string {
  return [
    '너는 동물병원 영수증·진료이력서·접종증명서 텍스트에서 기록을 추출하는 도구야.',
    '아래 텍스트에서 보이는 모든 기록을 JSON 으로만 답해. 설명·코드펜스 없이 JSON 객체 하나만 출력해.',
    '형식: {"records":[{"type","date","clinic","category","name","cost"}]}',
    '- type: 병원 진료/검사/수술이면 "medical", 접종/구충/심장사상충/외부기생충/건강검진/미용/양치/발톱/목욕/귀청소면 "care"',
    '- date: YYYY-MM-DD. 연도 불명확하면 빈 문자열(추측 금지)',
    '- category: care 일 때만 (접종/심장사상충/구충/외부기생충/건강검진/미용/양치/발톱/목욕/귀청소/기타)',
    '- name: 항목명/백신명/진단명, clinic: 병원·업체명, cost: 금액(숫자만, 없으면 0)',
    '- 확실하지 않은 값은 비워 둬. 없는 정보를 지어내지 마.',
    '',
    '텍스트:',
    input,
  ].join('\n')
}

/** 금액을 숫자로 관대하게 강제(문자열 "35,000원" → 35000, 그 외/빈값 → undefined) */
function coerceCost(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string') {
    const m = v.replace(/,/g, '').match(/\d+/)
    if (m) return parseInt(m[0], 10)
  }
  return undefined
}

const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t : undefined
}

/**
 * 모델 응답 텍스트에서 레코드 배열을 관대하게 파싱(순수).
 * - ```json 코드펜스나 앞뒤 설명이 섞여도 첫 JSON 덩어리({...} 또는 [...])를 뽑아 파싱.
 * - 최상위가 {records:[...]} 든 [...] 든 모두 수용.
 * - gold 와 같은 필드로 정규화. 파싱 불가/형식 불일치면 빈 배열.
 */
export function parseRecordsFromContent(content: string | undefined | null): OcrEvalRecord[] {
  if (!content) return []
  let raw = content.trim()
  // 코드펜스 제거
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  // 첫 JSON 덩어리 추출(객체 우선, 없으면 배열)
  if (!(raw.startsWith('{') || raw.startsWith('['))) {
    const obj = raw.indexOf('{')
    const arr = raw.indexOf('[')
    const start = obj === -1 ? arr : arr === -1 ? obj : Math.min(obj, arr)
    if (start === -1) return []
    const lastObj = raw.lastIndexOf('}')
    const lastArr = raw.lastIndexOf(']')
    const end = Math.max(lastObj, lastArr)
    if (end <= start) return []
    raw = raw.slice(start, end + 1)
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { records?: unknown })?.records)
      ? (parsed as { records: unknown[] }).records
      : []
  return list
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map(r => {
      const rec: OcrEvalRecord = {}
      const type = str(r.type); if (type) rec.type = type
      const date = str(r.date); if (date) rec.date = date
      const clinic = str(r.clinic); if (clinic) rec.clinic = clinic
      const category = str(r.category); if (category) rec.category = category
      const name = str(r.name); if (name) rec.name = name
      const cost = coerceCost(r.cost); if (cost != null) rec.cost = cost
      return rec
    })
}

/** 라이브 호출 1건의 계측(비용·지연 집계용) */
export interface LiveCall {
  usage: unknown
  latencyMs: number
  success: boolean
}

/**
 * 실제 모델로 추출하는 예측기. 호출마다 usage/지연/성공을 calls 에 수집(비용·지연 집계에 사용).
 * 네트워크/키가 있어야 동작하며, 실패하면 빈 예측(해당 케이스는 전부 놓친 것으로 채점).
 */
export function makeLivePredictor(spec: ModelSpec, calls: LiveCall[]): OcrPredictor {
  const model = buildModel(spec)
  return async (input: string) => {
    const t0 = Date.now()
    try {
      const { text, usage } = await generateText({ model, prompt: buildExtractPrompt(input), temperature: 0 })
      const records = parseRecordsFromContent(text)
      calls.push({ usage, latencyMs: Date.now() - t0, success: true })
      return records
    } catch {
      calls.push({ usage: undefined, latencyMs: Date.now() - t0, success: false })
      return []
    }
  }
}

export interface CallSummary {
  provider: string
  model: string
  calls: number
  successes: number
  totalTokens: number
  /** 아는 비용(USD) 합. 단가 미상이면 null */
  costUsd: number | null
  avgLatencyMs: number | null
}

/** 수집한 라이브 호출들을 모델 단위 비용/지연으로 집계(순수). 비용은 모델 단가로 환산. */
export function summarizeCalls(spec: ModelSpec, calls: LiveCall[]): CallSummary {
  const price = priceFor(spec.provider, spec.model)
  let totalTokens = 0
  let costUsd: number | null = null
  let latSum = 0
  let latN = 0
  let successes = 0
  for (const c of calls) {
    if (c.success) successes++
    const u = normalizeUsage(c.usage)
    totalTokens += u.totalTokens ?? 0
    const cost = estimateCostUsd(price, u)
    if (cost != null) costUsd = (costUsd ?? 0) + cost
    if (Number.isFinite(c.latencyMs)) { latSum += c.latencyMs; latN++ }
  }
  return {
    provider: spec.provider,
    model: spec.model,
    calls: calls.length,
    successes,
    totalTokens,
    costUsd: costUsd != null ? Math.round(costUsd * 1e6) / 1e6 : null,
    avgLatencyMs: latN > 0 ? Math.round(latSum / latN) : null,
  }
}

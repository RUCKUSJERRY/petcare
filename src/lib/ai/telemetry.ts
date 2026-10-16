import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUsage } from './usage'
import { estimateCostUsd, priceFor } from './cost'

/**
 * LLM 호출 텔레메트리(ai_events) 기록.
 *
 * 역할 분리:
 * - buildAiEvent: 순수 함수. 입력(usage·시간·provider/model·성공여부 등)으로 ai_events 행을 조립한다.
 *   usage 정규화와 비용 계산(토큰 x 단가)을 여기서 결정적으로 수행 → 테스트로 고정.
 * - recordAiEvent: best-effort insert. 테이블이 없거나 실패해도 본 기능(챗 스트리밍 등)을 막지 않는다.
 *
 * 이렇게 두면 계측 로직(무엇을 어떻게 기록할지)은 테스트 가능하고, 부수효과(DB 쓰기)는 얇게 유지된다.
 */

export type AiFeature = 'chat' | 'ocr' | 'parse'

/** buildAiEvent 입력 — 호출부가 아는 raw 값들 */
export interface AiEventInput {
  feature: AiFeature
  provider: string
  model: string
  userId?: string | null
  /** AI SDK LanguageModelUsage 또는 OpenAI 호환 usage (정규화 전 raw) */
  usage?: unknown
  /** 호출 지연(ms). startedAt 만 주면 now 기준으로 계산 */
  latencyMs?: number
  startedAt?: number
  success?: boolean
  errorCode?: string | null
  requestId?: string | null
}

/** ai_events 테이블에 넣을 1행 (컬럼명 1:1) */
export interface AiEventRow {
  feature: string
  provider: string
  model: string
  user_id: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  latency_ms: number | null
  cost_usd: number | null
  success: boolean
  error_code: string | null
  request_id: string | null
}

/** 유한한 음이 아닌 정수만, 그 외 null */
function toLatency(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null
}

/**
 * 입력으로부터 ai_events 행을 조립한다(순수). usage 정규화 + 비용 계산 포함.
 * @param now 결정적 테스트를 위해 '현재시각'을 주입 가능(기본 Date.now).
 */
export function buildAiEvent(input: AiEventInput, now: number = Date.now()): AiEventRow {
  const usage = normalizeUsage(input.usage)
  const cost = estimateCostUsd(priceFor(input.provider, input.model), usage)
  const latency = input.latencyMs != null
    ? toLatency(input.latencyMs)
    : input.startedAt != null
      ? toLatency(now - input.startedAt)
      : null
  return {
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    user_id: input.userId ?? null,
    prompt_tokens: usage.inputTokens,
    completion_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    latency_ms: latency,
    cost_usd: cost,
    success: input.success ?? true,
    error_code: input.errorCode ?? null,
    request_id: input.requestId ?? null,
  }
}

/**
 * ai_events 에 1건 기록(best-effort). 실패해도 throw 하지 않는다 — 계측이 본 기능을 깨면 안 되므로.
 * 사용자 세션 클라이언트로 호출하면 RLS(insert own)로 본인 user_id 행만 들어간다.
 */
export async function recordAiEvent(client: SupabaseClient, input: AiEventInput): Promise<void> {
  try {
    const row = buildAiEvent(input)
    const { error } = await client.from('ai_events').insert(row)
    if (error) console.error('[ai_events] insert failed', input.feature, error.message)
  } catch (e) {
    console.error('[ai_events] record error', input.feature, e)
  }
}

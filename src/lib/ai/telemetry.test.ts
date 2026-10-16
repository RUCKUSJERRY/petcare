import { describe, expect, it } from 'vitest'
import { buildAiEvent } from './telemetry'

describe('buildAiEvent', () => {
  it('provider/model/feature/user 를 그대로 싣고 usage 를 정규화한다', () => {
    const row = buildAiEvent({
      feature: 'chat',
      provider: 'upstage',
      model: 'solar-pro2',
      userId: 'u1',
      usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
      latencyMs: 850,
    })
    expect(row.feature).toBe('chat')
    expect(row.provider).toBe('upstage')
    expect(row.model).toBe('solar-pro2')
    expect(row.user_id).toBe('u1')
    expect(row.prompt_tokens).toBe(1000)
    expect(row.completion_tokens).toBe(200)
    expect(row.total_tokens).toBe(1200)
    expect(row.latency_ms).toBe(850)
    expect(row.success).toBe(true)
  })

  it('알려진 모델이면 비용(USD)을 계산한다', () => {
    const row = buildAiEvent({
      feature: 'chat', provider: 'upstage', model: 'solar-pro2',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
    })
    // solar-pro2 input 단가 x 100만 토큰 = 그 단가(USD). 양수여야 한다.
    expect(row.cost_usd).not.toBeNull()
    expect(row.cost_usd!).toBeGreaterThan(0)
  })

  it('단가 미상 모델이면 cost_usd=null (날조 금지)', () => {
    const row = buildAiEvent({
      feature: 'chat', provider: 'openai', model: 'gpt-unknown',
      usage: { inputTokens: 1000, outputTokens: 500 },
    })
    expect(row.cost_usd).toBeNull()
  })

  it('startedAt + 주입 now 로 지연을 계산한다(결정적)', () => {
    const row = buildAiEvent(
      { feature: 'chat', provider: 'upstage', model: 'solar-pro2', startedAt: 1000 },
      1900,
    )
    expect(row.latency_ms).toBe(900)
  })

  it('실패 이벤트: success=false + error_code, usage 미상이면 토큰/비용 null', () => {
    const row = buildAiEvent({
      feature: 'chat', provider: 'upstage', model: 'solar-pro2',
      success: false, errorCode: 'stream_error',
    })
    expect(row.success).toBe(false)
    expect(row.error_code).toBe('stream_error')
    expect(row.prompt_tokens).toBeNull()
    expect(row.total_tokens).toBeNull()
    expect(row.cost_usd).toBeNull()
  })

  it('user·latency·requestId 미지정이면 null 로 채운다', () => {
    const row = buildAiEvent({ feature: 'ocr', provider: 'gemini', model: 'gemini-3.6-flash' })
    expect(row.user_id).toBeNull()
    expect(row.latency_ms).toBeNull()
    expect(row.request_id).toBeNull()
  })
})

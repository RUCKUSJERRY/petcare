import { describe, expect, it } from 'vitest'
import { aggregateAiEvents, type AiEventRow } from './stats'

const row = (p: Partial<AiEventRow>): AiEventRow => ({
  provider: 'upstage', model: 'solar-pro2', feature: 'chat',
  success: true, cost_usd: null, total_tokens: null, latency_ms: null, ...p,
})

describe('aggregateAiEvents', () => {
  it('빈 입력이면 total.calls=0, 비용/지연 null', () => {
    const s = aggregateAiEvents([])
    expect(s.total.calls).toBe(0)
    expect(s.total.costUsd).toBeNull()
    expect(s.total.avgLatencyMs).toBeNull()
    expect(s.byProvider).toEqual([])
  })

  it('성공률·토큰 합·평균지연을 계산한다', () => {
    const s = aggregateAiEvents([
      row({ success: true, total_tokens: 100, latency_ms: 200 }),
      row({ success: false, total_tokens: 50, latency_ms: 400 }),
    ])
    expect(s.total.calls).toBe(2)
    expect(s.total.successes).toBe(1)
    expect(s.total.successRate).toBe(50)
    expect(s.total.tokens).toBe(150)
    expect(s.total.avgLatencyMs).toBe(300)
  })

  it('아는 비용만 합산한다(미상 null 은 제외)', () => {
    const s = aggregateAiEvents([
      row({ cost_usd: 0.001 }),
      row({ cost_usd: null }),       // 미상 — 합산 제외
      row({ cost_usd: 0.002 }),
    ])
    expect(s.total.costUsd).toBeCloseTo(0.003, 9)
  })

  it('비용 아는 행이 하나도 없으면 costUsd=null (0 으로 왜곡하지 않음)', () => {
    const s = aggregateAiEvents([row({ cost_usd: null }), row({ cost_usd: null })])
    expect(s.total.costUsd).toBeNull()
  })

  it('지연 아는 행이 없으면 avgLatencyMs=null', () => {
    const s = aggregateAiEvents([row({ latency_ms: null })])
    expect(s.total.avgLatencyMs).toBeNull()
  })

  it('provider/model/feature 별로 나누고 호출수 내림차순 정렬', () => {
    const s = aggregateAiEvents([
      row({ provider: 'upstage', model: 'solar-pro2', feature: 'chat' }),
      row({ provider: 'upstage', model: 'solar-pro2', feature: 'chat' }),
      row({ provider: 'gemini', model: 'gemini-3.6-flash', feature: 'ocr' }),
    ])
    expect(s.byProvider[0]).toMatchObject({ key: 'upstage', calls: 2 })
    expect(s.byProvider[1]).toMatchObject({ key: 'gemini', calls: 1 })
    expect(s.byModel[0].key).toBe('upstage:solar-pro2')
    expect(s.byFeature.map(f => f.key).sort()).toEqual(['chat', 'ocr'])
  })

  it('같은 model 이름이라도 provider 가 다르면 분리 집계', () => {
    const s = aggregateAiEvents([
      row({ provider: 'upstage', model: 'x' }),
      row({ provider: 'openai', model: 'x' }),
    ])
    expect(s.byModel.map(m => m.key).sort()).toEqual(['openai:x', 'upstage:x'])
  })
})

import { describe, expect, it } from 'vitest'
import { normalizeUsage } from './usage'

describe('normalizeUsage', () => {
  it('AI SDK(camelCase) 형태를 읽는다', () => {
    expect(normalizeUsage({ inputTokens: 120, outputTokens: 30, totalTokens: 150 })).toEqual({
      inputTokens: 120, outputTokens: 30, totalTokens: 150,
    })
  })

  it('OpenAI 호환(snake_case) 형태를 읽는다', () => {
    expect(normalizeUsage({ prompt_tokens: 200, completion_tokens: 50, total_tokens: 250 })).toEqual({
      inputTokens: 200, outputTokens: 50, totalTokens: 250,
    })
  })

  it('Gemini(usageMetadata) 형태를 읽는다', () => {
    expect(normalizeUsage({ promptTokenCount: 512, candidatesTokenCount: 88, totalTokenCount: 600 })).toEqual({
      inputTokens: 512, outputTokens: 88, totalTokens: 600,
    })
  })

  it('total 이 없으면 input+output 으로 보완한다', () => {
    expect(normalizeUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
      inputTokens: 10, outputTokens: 5, totalTokens: 15,
    })
  })

  it('한쪽만 알면 total 을 보완하지 않는다(과소계상 방지)', () => {
    expect(normalizeUsage({ inputTokens: 10 })).toEqual({
      inputTokens: 10, outputTokens: null, totalTokens: null,
    })
  })

  it('undefined·NaN·음수는 null(미상) 로 둔다 — 0 과 구분', () => {
    expect(normalizeUsage({ inputTokens: undefined, outputTokens: NaN, totalTokens: -5 })).toEqual({
      inputTokens: null, outputTokens: null, totalTokens: null,
    })
  })

  it('입력이 없으면 모두 null', () => {
    expect(normalizeUsage(undefined)).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
    expect(normalizeUsage(null)).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
    expect(normalizeUsage({})).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
  })

  it('소수 토큰 값은 반올림한다', () => {
    expect(normalizeUsage({ inputTokens: 10.4, outputTokens: 5.6 }).inputTokens).toBe(10)
    expect(normalizeUsage({ inputTokens: 10.4, outputTokens: 5.6 }).outputTokens).toBe(6)
  })
})

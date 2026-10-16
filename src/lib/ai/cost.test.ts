import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estimateCostUsd, priceFor, type ModelPrice } from './cost'

describe('estimateCostUsd', () => {
  const price: ModelPrice = { inputPerMTok: 1, outputPerMTok: 3 } // USD / 1M tok

  it('입력·출력 토큰 x 단가 / 100만', () => {
    // 1,000,000 input x $1 + 1,000,000 output x $3 = $4
    expect(estimateCostUsd(price, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(4)
    // 1000 input x $1/Mtok = $0.001
    expect(estimateCostUsd(price, { inputTokens: 1000, outputTokens: 0 })).toBeCloseTo(0.001, 9)
  })

  it('단가 미상(null)이면 비용도 null — 날조하지 않음', () => {
    expect(estimateCostUsd(null, { inputTokens: 1000, outputTokens: 500 })).toBeNull()
  })

  it('토큰 둘 다 미상이면 null, 한쪽만 알면 아는 부분만 계산', () => {
    expect(estimateCostUsd(price, { inputTokens: null, outputTokens: null })).toBeNull()
    // output 만 알면 input 은 0 으로 보되 '미상'인 input 때문에 null 로 떨구지 않는다
    expect(estimateCostUsd(price, { inputTokens: null, outputTokens: 1_000_000 })).toBe(3)
  })

  it('0 토큰은 0 비용(미상과 구분)', () => {
    expect(estimateCostUsd(price, { inputTokens: 0, outputTokens: 0 })).toBe(0)
  })
})

describe('priceFor', () => {
  it('코드 기본표의 알려진 모델은 단가를 돌려준다', () => {
    const p = priceFor('upstage', 'solar-pro2')
    expect(p).not.toBeNull()
    expect(p!.inputPerMTok).toBeGreaterThan(0)
  })

  it('대소문자 무관', () => {
    expect(priceFor('Upstage', 'Solar-Pro2')).not.toBeNull()
  })

  it('모르는 모델은 null(미상)', () => {
    expect(priceFor('openai', 'gpt-nonexistent')).toBeNull()
  })

  describe('환경변수 오버라이드', () => {
    const KEY = 'AI_PRICE_OPENAI_GPT_TEST'
    beforeEach(() => { process.env[KEY] = '2,8' })
    afterEach(() => { delete process.env[KEY] })

    it('AI_PRICE_<PROVIDER>_<MODEL> 로 단가를 주입한다', () => {
      const p = priceFor('openai', 'gpt-test')
      expect(p).toEqual({ inputPerMTok: 2, outputPerMTok: 8 })
    })

    it('오버라이드가 코드 기본표보다 우선한다', () => {
      process.env.AI_PRICE_UPSTAGE_SOLAR_PRO2 = '9,9'
      expect(priceFor('upstage', 'solar-pro2')).toEqual({ inputPerMTok: 9, outputPerMTok: 9 })
      delete process.env.AI_PRICE_UPSTAGE_SOLAR_PRO2
    })
  })
})

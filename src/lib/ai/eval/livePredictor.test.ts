import { describe, expect, it } from 'vitest'
import { buildExtractPrompt, parseRecordsFromContent, summarizeCalls, type LiveCall } from './livePredictor'
import type { ModelSpec } from '../models/registry'

describe('buildExtractPrompt', () => {
  it('입력 텍스트와 필드 지시를 포함한다', () => {
    const p = buildExtractPrompt('행복동물병원 2026-01-12 종합백신 35,000원')
    expect(p).toContain('행복동물병원 2026-01-12 종합백신')
    expect(p).toContain('"records"')
    expect(p).toContain('YYYY-MM-DD')
  })
})

describe('parseRecordsFromContent', () => {
  it('{records:[...]} 형태를 파싱하고 필드 정규화', () => {
    const out = parseRecordsFromContent('{"records":[{"type":"care","date":"2026-01-12","name":"종합백신","cost":35000}]}')
    expect(out).toEqual([{ type: 'care', date: '2026-01-12', name: '종합백신', cost: 35000 }])
  })

  it('최상위 배열도 수용', () => {
    const out = parseRecordsFromContent('[{"type":"medical","date":"2026-02-08","name":"외이염"}]')
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('medical')
  })

  it('코드펜스 + 앞뒤 설명이 섞여도 JSON 을 뽑아낸다', () => {
    const content = '다음과 같이 추출했어요:\n```json\n{"records":[{"date":"2026-05-01","name":"미용"}]}\n```\n확인해 주세요.'
    const out = parseRecordsFromContent(content)
    expect(out).toEqual([{ date: '2026-05-01', name: '미용' }])
  })

  it('cost 가 "35,000원" 문자열이어도 숫자로 강제', () => {
    const out = parseRecordsFromContent('{"records":[{"name":"x","cost":"35,000원"}]}')
    expect(out[0].cost).toBe(35000)
  })

  it('빈 문자열 필드는 생략(undefined)', () => {
    const out = parseRecordsFromContent('{"records":[{"date":"","name":"광견병","category":""}]}')
    expect(out[0]).toEqual({ name: '광견병' })
  })

  it('파싱 불가/빈 입력은 빈 배열', () => {
    expect(parseRecordsFromContent('죄송해요 JSON 을 못 만들었어요')).toEqual([])
    expect(parseRecordsFromContent('')).toEqual([])
    expect(parseRecordsFromContent(null)).toEqual([])
  })
})

describe('summarizeCalls', () => {
  const spec: ModelSpec = { id: 'upstage:solar-pro2', provider: 'upstage', model: 'solar-pro2', baseURL: 'x', apiKey: 'k' }

  it('토큰 합·평균 지연·성공수를 집계하고 단가로 비용 환산', () => {
    const calls: LiveCall[] = [
      { usage: { inputTokens: 1_000_000, outputTokens: 0 }, latencyMs: 800, success: true },
      { usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 1200, success: true },
    ]
    const s = summarizeCalls(spec, calls)
    expect(s.calls).toBe(2)
    expect(s.successes).toBe(2)
    expect(s.totalTokens).toBe(1_000_000)
    expect(s.avgLatencyMs).toBe(1000)
    expect(s.costUsd).not.toBeNull()
    expect(s.costUsd!).toBeGreaterThan(0) // solar-pro2 단가 존재
  })

  it('단가 미상 모델이면 비용 null', () => {
    const unknown: ModelSpec = { id: 'x:y', provider: 'x', model: 'y', baseURL: 'b', apiKey: 'k' }
    const s = summarizeCalls(unknown, [{ usage: { totalTokens: 100 }, latencyMs: 10, success: true }])
    expect(s.costUsd).toBeNull()
    expect(s.totalTokens).toBe(100)
  })

  it('실패 호출은 successes 에서 빠진다', () => {
    const s = summarizeCalls(spec, [{ usage: undefined, latencyMs: 50, success: false }])
    expect(s.successes).toBe(0)
    expect(s.calls).toBe(1)
  })
})

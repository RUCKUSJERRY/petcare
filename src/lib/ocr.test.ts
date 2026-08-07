import { describe, expect, it } from 'vitest'
import { parseOcrText } from './ocr'

describe('parseOcrText — 날짜 추출', () => {
  it('유효한 날짜를 YYYY-MM-DD 로 정규화한다', () => {
    expect(parseOcrText('진료일 2026.8.7 합계').date).toBe('2026-08-07')
    expect(parseOcrText('2026년 12월 3일').date).toBe('2026-12-03')
    expect(parseOcrText('2026-01-09').date).toBe('2026-01-09')
  })

  it('달력상 불가능한 월/일(오인식)은 채우지 않는다', () => {
    // 정규식은 통과하지만 Postgres date 로 저장 시 깨지는 값 — 빈 문자열로 남긴다.
    expect(parseOcrText('2026.13.45').date).toBe('')
    expect(parseOcrText('2026.00.10').date).toBe('')
    expect(parseOcrText('2026.02.00').date).toBe('')
  })

  it('날짜가 없으면 빈 문자열', () => {
    expect(parseOcrText('영수증 감사합니다').date).toBe('')
  })
})

describe('parseOcrText — 금액 추출', () => {
  it('가장 큰 금액을 합계로 본다', () => {
    expect(parseOcrText('부가세 3000 합계 35,000원').cost).toBe(35000)
  })

  it('금액이 없으면 0', () => {
    expect(parseOcrText('현금영수증').cost).toBe(0)
  })
})

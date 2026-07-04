import { describe, it, expect } from 'vitest'
import { buildRecordsHtml, type ExportRecord } from './exportRecords'

const rows: ExportRecord[] = [
  { pet_name: '초코', category: '접종', title: '종합백신', event_on: '2026-01-10', place_name: '행복동물병원', cost: 30000, memo: null },
]

describe('buildRecordsHtml — 워터마크(무료 등급 게이팅)', () => {
  it('무료(watermark=true)면 반복 텍스트 워터마크가 들어간다', () => {
    const html = buildRecordsHtml('초코 기록', rows, { watermark: true })
    expect(html).toContain('<div class="wm">')
    // 전경 텍스트로 여러 번 타일링되어야 인쇄('배경 그래픽' OFF)에도 남는다.
    const count = html.split('펫케어 무료 · PETCARE').length - 1
    expect(count).toBeGreaterThan(10)
  })

  it('워터마크는 배경이 아닌 전경 텍스트 + print-color-adjust:exact 로 인쇄를 강제한다', () => {
    const html = buildRecordsHtml('초코 기록', rows, { watermark: true })
    expect(html).toContain('print-color-adjust: exact')
    // 회귀: 예전엔 background-image 그라디언트에만 의존해 PDF 저장 시 통째로 사라졌다.
    expect(html).not.toContain('repeating-linear-gradient')
  })

  it('프리미엄(watermark=false)이면 워터마크가 없다', () => {
    const html = buildRecordsHtml('초코 기록', rows, {})
    expect(html).not.toContain('<div class="wm">')
    expect(html).not.toContain('펫케어 무료 · PETCARE')
  })
})

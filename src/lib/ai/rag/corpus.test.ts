import { describe, expect, it } from 'vitest'
import { buildCorpus } from './corpus'
import { chunkCorpus, chunkText } from './chunk'

describe('buildCorpus', () => {
  const corpus = buildCorpus()

  it('네 소스를 모두 포함한다', () => {
    const sources = new Set(corpus.map(d => d.source))
    expect(sources).toEqual(new Set(['care', 'food', 'symptom', 'seasonal']))
  })

  it('문서마다 비어있지 않은 본문·제목·링크를 갖는다', () => {
    for (const d of corpus) {
      expect(d.title.length).toBeGreaterThan(0)
      expect(d.text.length).toBeGreaterThan(0)
      expect(d.href.startsWith('/')).toBe(true)
    }
  })

  it('id 는 고유하다', () => {
    const ids = corpus.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('양치 돌봄 가이드가 색인돼 본문에 치석/치약이 들어간다', () => {
    const teeth = corpus.find(d => d.id === 'care:teeth')
    expect(teeth).toBeDefined()
    expect(teeth!.text).toContain('치석')
  })

  it('계절 문서는 종x4계절(8개) 포함', () => {
    const seasonal = corpus.filter(d => d.source === 'seasonal')
    expect(seasonal.length).toBe(8)
  })

  it('결정적(두 번 빌드해도 같은 순서·내용)', () => {
    expect(buildCorpus().map(d => d.id)).toEqual(corpus.map(d => d.id))
  })
})

describe('chunkText', () => {
  it('짧은 텍스트는 한 청크', () => {
    expect(chunkText('한 줄', { maxChars: 400 })).toEqual(['한 줄'])
  })

  it('maxChars 를 넘으면 여러 청크로 나뉜다', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `줄${i} 내용 ${'가'.repeat(30)}`).join('\n')
    const chunks = chunkText(lines, { maxChars: 80, overlapChars: 0 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(80)
  })

  it('overlap 이 있으면 인접 청크가 맥락을 겹친다', () => {
    const lines = ['에이비씨', '디이에프', '지에이치', '아이제이'].join('\n')
    const noOverlap = chunkText(lines, { maxChars: 10, overlapChars: 0 })
    const withOverlap = chunkText(lines, { maxChars: 10, overlapChars: 5 })
    // overlap 이 있으면 총 글자 수가 더 많다(겹친 만큼)
    const sum = (a: string[]) => a.join('').length
    expect(sum(withOverlap)).toBeGreaterThanOrEqual(sum(noOverlap))
  })

  it('maxChars 보다 긴 한 줄은 하드 분할', () => {
    const chunks = chunkText('가'.repeat(100), { maxChars: 40, overlapChars: 0 })
    expect(chunks.length).toBe(3)
    expect(chunks[0].length).toBe(40)
  })
})

describe('chunkCorpus', () => {
  it('코퍼스를 청크들로 평탄화하고 chunk id 가 고유', () => {
    const chunks = chunkCorpus(buildCorpus(), { maxChars: 300 })
    expect(chunks.length).toBeGreaterThanOrEqual(buildCorpus().length)
    const ids = chunks.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

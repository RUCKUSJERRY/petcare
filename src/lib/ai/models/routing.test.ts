import { describe, expect, it } from 'vitest'
import { selectModel, type AiTask } from './routing'
import type { ModelSpec } from './registry'

const spec = (provider: string, model = 'm'): ModelSpec => ({
  id: `${provider}:${model}`, provider, model, baseURL: 'http://x', apiKey: 'k',
})

describe('selectModel', () => {
  it('구성된 모델이 없으면 null', () => {
    expect(selectModel('chat', [])).toBeNull()
  })

  it('chat 은 선호순(upstage 우선)으로 고른다', () => {
    const avail = [spec('groq'), spec('upstage'), spec('openai')]
    expect(selectModel('chat', avail)!.provider).toBe('upstage')
  })

  it('classify 는 오픈소스(groq) 우선', () => {
    const avail = [spec('upstage'), spec('groq')]
    expect(selectModel('classify', avail)!.provider).toBe('groq')
  })

  it('선호 provider 가 구성 안 됐으면 다음 선호로 폴백', () => {
    const avail = [spec('openai'), spec('together')]
    // chat 선호: upstage(없음) > openai(있음)
    expect(selectModel('chat', avail)!.provider).toBe('openai')
  })

  it('정책에 아무것도 안 맞으면 구성된 첫 번째로 폴백', () => {
    const policy = { chat: ['nonexistent'], extract: [], classify: [] } as Record<AiTask, string[]>
    const avail = [spec('together'), spec('groq')]
    expect(selectModel('chat', avail, policy)!.provider).toBe('together')
  })

  it('override 가 구성돼 있으면 최우선', () => {
    const avail = [spec('upstage'), spec('groq')]
    expect(selectModel('chat', avail, undefined, 'groq')!.provider).toBe('groq')
  })

  it('override 가 구성 안 됐으면 무시하고 정책대로', () => {
    const avail = [spec('upstage'), spec('openai')]
    expect(selectModel('chat', avail, undefined, 'groq')!.provider).toBe('upstage')
  })
})

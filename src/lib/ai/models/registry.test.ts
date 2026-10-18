import { describe, expect, it } from 'vitest'
import { specsFromEnv } from './registry'

describe('specsFromEnv', () => {
  it('키 없는 env 면 구성된 모델이 없다', () => {
    expect(specsFromEnv({})).toEqual([])
  })

  it('UPSTAGE_API_KEY 만 있으면 upstage 기본 모델이 잡힌다(기존 동작 유지)', () => {
    const specs = specsFromEnv({ UPSTAGE_API_KEY: 'k' })
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({ provider: 'upstage', model: 'solar-pro2', id: 'upstage:solar-pro2' })
    expect(specs[0].baseURL).toContain('api.upstage.ai')
  })

  it('기존 UPSTAGE_CHAT_MODEL/URL override 를 재사용한다', () => {
    const specs = specsFromEnv({ UPSTAGE_API_KEY: 'k', UPSTAGE_CHAT_MODEL: 'solar-pro', UPSTAGE_CHAT_URL: 'https://x/v1' })
    expect(specs[0]).toMatchObject({ model: 'solar-pro', baseURL: 'https://x/v1' })
  })

  it('오픈소스 서빙 provider(groq/together/openrouter)도 키만 있으면 잡힌다', () => {
    const specs = specsFromEnv({ GROQ_API_KEY: 'g', TOGETHER_API_KEY: 't', OPENROUTER_API_KEY: 'o' })
    const providers = specs.map(s => s.provider).sort()
    expect(providers).toEqual(['groq', 'openrouter', 'together'])
    expect(specs.find(s => s.provider === 'groq')!.model).toContain('llama')
  })

  it('모델 override env 가 기본 모델을 덮는다', () => {
    const specs = specsFromEnv({ GROQ_API_KEY: 'g', GROQ_MODEL: 'qwen-2.5-32b' })
    expect(specs[0].model).toBe('qwen-2.5-32b')
    expect(specs[0].id).toBe('groq:qwen-2.5-32b')
  })

  it('ollama(keyless)는 OLLAMA_BASE_URL 명시 시에만 활성', () => {
    expect(specsFromEnv({ OLLAMA_MODEL: 'llama3.1' })).toEqual([]) // baseURL 없으면 비활성
    const specs = specsFromEnv({ OLLAMA_BASE_URL: 'http://localhost:11434/v1' })
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({ provider: 'ollama', apiKey: 'not-needed' })
  })

  it('여러 provider 가 동시에 구성되면 모두 반환', () => {
    const specs = specsFromEnv({ UPSTAGE_API_KEY: 'u', OPENAI_API_KEY: 'o', GEMINI_API_KEY: 'g' })
    expect(specs.map(s => s.provider).sort()).toEqual(['gemini', 'openai', 'upstage'])
  })
})

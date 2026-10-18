import { describe, expect, it } from 'vitest'
import { embeddingSpecFromEnv, embeddingAvailable } from './embed'

describe('embeddingSpecFromEnv', () => {
  it('키 없으면 null', () => {
    expect(embeddingSpecFromEnv({})).toBeNull()
    expect(embeddingAvailable({})).toBe(false)
  })

  it('전용 EMBEDDING_* 를 최우선으로', () => {
    const spec = embeddingSpecFromEnv({
      EMBEDDING_API_KEY: 'k', EMBEDDING_MODEL: 'my-embed', EMBEDDING_BASE_URL: 'https://x/v1', EMBEDDING_PROVIDER: 'custom',
      OPENAI_API_KEY: 'o',
    })
    expect(spec).toMatchObject({ provider: 'custom', model: 'my-embed', baseURL: 'https://x/v1' })
  })

  it('OPENAI_API_KEY 면 text-embedding-3-small 기본', () => {
    const spec = embeddingSpecFromEnv({ OPENAI_API_KEY: 'o' })
    expect(spec).toMatchObject({ provider: 'openai', model: 'text-embedding-3-small' })
  })

  it('openai 우선, 그다음 upstage 폴백', () => {
    expect(embeddingSpecFromEnv({ UPSTAGE_API_KEY: 'u' })!.provider).toBe('upstage')
    expect(embeddingSpecFromEnv({ OPENAI_API_KEY: 'o', UPSTAGE_API_KEY: 'u' })!.provider).toBe('openai')
  })

  it('모델 override env 적용', () => {
    expect(embeddingSpecFromEnv({ OPENAI_API_KEY: 'o', OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large' })!.model)
      .toBe('text-embedding-3-large')
  })
})

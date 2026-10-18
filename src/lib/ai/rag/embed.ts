import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { embedMany } from 'ai'
import type { RagIndex } from './retriever'
import { toDocRanking, type DocRetriever } from './evalRetrieval'

/**
 * 임베딩 provider + 벡터/하이브리드 실동작 연결.
 *
 * RAG 검색 코어는 임베딩을 '주입받는' 순수 구조다. 여기서 실제 임베딩 모델(OpenAI 호환 embeddings)로
 * 청크·질의를 벡터화해 vector/hybrid 를 켠다. 네트워크 호출은 얇게, provider 선택은 순수(env 주입)로.
 */

export interface EmbeddingSpec {
  provider: string
  model: string
  baseURL: string
  apiKey: string
}

interface EmbedPreset {
  provider: string
  baseURL: string
  defaultModel: string
  keyEnv: string
  modelEnv: string
}

/** OpenAI 호환 embeddings 프리셋. 전용 EMBEDDING_* 가 있으면 그걸 최우선으로 쓴다. */
const EMBED_PRESETS: EmbedPreset[] = [
  { provider: 'openai', baseURL: 'https://api.openai.com/v1', defaultModel: 'text-embedding-3-small', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_EMBEDDING_MODEL' },
  { provider: 'upstage', baseURL: 'https://api.upstage.ai/v1', defaultModel: 'embedding-passage', keyEnv: 'UPSTAGE_API_KEY', modelEnv: 'UPSTAGE_EMBEDDING_MODEL' },
]

type Env = Record<string, string | undefined>

/** env 로 임베딩 스펙을 고른다(순수). 전용 EMBEDDING_* > 프리셋(openai > upstage) > null. */
export function embeddingSpecFromEnv(env: Env = process.env): EmbeddingSpec | null {
  if (env.EMBEDDING_API_KEY && env.EMBEDDING_MODEL) {
    return {
      provider: env.EMBEDDING_PROVIDER || 'custom',
      model: env.EMBEDDING_MODEL,
      baseURL: env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1',
      apiKey: env.EMBEDDING_API_KEY,
    }
  }
  for (const p of EMBED_PRESETS) {
    const apiKey = env[p.keyEnv]
    if (apiKey) return { provider: p.provider, model: env[p.modelEnv] || p.defaultModel, baseURL: p.baseURL, apiKey }
  }
  return null
}

/** 임베딩 provider 가 구성됐는지. */
export function embeddingAvailable(env: Env = process.env): boolean {
  return embeddingSpecFromEnv(env) != null
}

export interface Embedder {
  spec: EmbeddingSpec
  embed: (texts: string[]) => Promise<number[][]>
}

/** 구성된 임베딩 모델로 embedder 생성. 미구성이면 null. */
export function getEmbedder(env: Env = process.env): Embedder | null {
  const spec = embeddingSpecFromEnv(env)
  if (!spec) return null
  const client = createOpenAICompatible({ name: spec.provider, baseURL: spec.baseURL, apiKey: spec.apiKey })
  const model = client.textEmbeddingModel(spec.model)
  return {
    spec,
    embed: async (texts: string[]) => {
      if (texts.length === 0) return []
      const { embeddings } = await embedMany({ model, values: texts })
      return embeddings
    },
  }
}

/**
 * 인덱스의 모든 청크를 임베딩해 index.setEmbeddings 로 주입하고, 질의 임베딩에 쓸 embedder 를 돌려준다.
 * 임베딩 provider 미구성이면 throw(호출부가 embeddingAvailable 로 먼저 확인).
 */
export async function embedIndex(index: RagIndex): Promise<Embedder> {
  const embedder = getEmbedder()
  if (!embedder) throw new Error('embedding provider not configured')
  const texts = index.chunks.map(c => `${c.title}\n${c.text}`)
  const vectors = await embedder.embed(texts)
  const map = new Map<string, number[]>()
  index.chunks.forEach((c, i) => { if (vectors[i]) map.set(c.id, vectors[i]) })
  index.setEmbeddings(map)
  return embedder
}

/** 질의를 임베딩해 벡터 검색 > 문서 순위. */
export function vectorDocRetriever(index: RagIndex, embedder: Embedder, pool = 30): DocRetriever {
  return async (query: string) => {
    const [qv] = await embedder.embed([query])
    if (!qv) return []
    return toDocRanking(index.searchVector(qv, pool).map(s => s.item))
  }
}

/** 질의를 임베딩해 하이브리드(lexical+vector RRF) 검색 > 문서 순위. */
export function hybridDocRetriever(index: RagIndex, embedder: Embedder, pool = 30): DocRetriever {
  return async (query: string) => {
    const [qv] = await embedder.embed([query])
    return toDocRanking(index.searchHybrid(query, qv ?? null, pool).map(s => s.item))
  }
}

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

/**
 * 모델 레지스트리 — "다양한 모델(상용·오픈소스)을 한 틀로 끼운다".
 *
 * 핵심 통찰: Upstage·OpenAI·Groq·Together·OpenRouter·Ollama·Gemini 모두 OpenAI 호환
 * (chat.completions) 엔드포인트를 제공한다. 그래서 provider 별 SDK 를 따로 쓰지 않고
 * createOpenAICompatible 하나로 전부 연결한다 — 오픈소스 모델(Llama/Qwen/Mistral 등)도
 * Groq/Together/Ollama/OpenRouter 를 통해 같은 경로로 쓸 수 있다.
 *
 * 비밀키는 env 에만 둔다(DB 금지 — OCR/챗 기존 원칙과 동일). 어떤 provider 를 '구성됨'으로
 * 볼지는 env 로 결정한다(키가 있으면 사용 가능). specsFromEnv 는 env 를 주입받는 순수 함수라
 * 테스트로 고정할 수 있다.
 */

export interface ModelSpec {
  /** 고유 id — `${provider}:${model}` */
  id: string
  provider: string
  model: string
  baseURL: string
  apiKey: string
}

interface Preset {
  provider: string
  baseURL: string
  defaultModel: string
  /** api key env 이름. keyless(provider 로컬)면 생략 */
  keyEnv?: string
  /** 모델 override env 이름 */
  modelEnv: string
  /** baseURL override env 이름 */
  baseUrlEnv: string
  /** 로컬(Ollama 등) — 키 없이 baseURL 지정 시에만 활성 */
  keyless?: boolean
}

/**
 * OpenAI 호환 provider 프리셋. 오픈소스 모델을 서빙하는 곳(groq/together/openrouter/ollama)을
 * 일부러 포함해 "오픈소스 LLM 활용"을 바로 열어둔다.
 * - upstage 는 기존 env 이름(UPSTAGE_API_KEY/UPSTAGE_CHAT_MODEL/UPSTAGE_CHAT_URL)을 그대로 재사용해
 *   기존 배포 동작을 바꾸지 않는다.
 */
const PRESETS: Preset[] = [
  { provider: 'upstage', baseURL: 'https://api.upstage.ai/v1', defaultModel: 'solar-pro2', keyEnv: 'UPSTAGE_API_KEY', modelEnv: 'UPSTAGE_CHAT_MODEL', baseUrlEnv: 'UPSTAGE_CHAT_URL' },
  { provider: 'openai', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', baseUrlEnv: 'OPENAI_BASE_URL' },
  { provider: 'groq', baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', baseUrlEnv: 'GROQ_BASE_URL' },
  { provider: 'together', baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyEnv: 'TOGETHER_API_KEY', modelEnv: 'TOGETHER_MODEL', baseUrlEnv: 'TOGETHER_BASE_URL' },
  { provider: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'qwen/qwen-2.5-72b-instruct', keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'OPENROUTER_MODEL', baseUrlEnv: 'OPENROUTER_BASE_URL' },
  { provider: 'gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-3.6-flash', keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_CHAT_MODEL', baseUrlEnv: 'GEMINI_OPENAI_BASE_URL' },
  { provider: 'ollama', baseURL: 'http://localhost:11434/v1', defaultModel: 'llama3.1', modelEnv: 'OLLAMA_MODEL', baseUrlEnv: 'OLLAMA_BASE_URL', keyless: true },
]

type Env = Record<string, string | undefined>

/**
 * env 에서 '구성된' 모델 스펙 목록을 만든다(순수).
 * - 키 기반 provider: keyEnv 가 있으면 포함.
 * - keyless(ollama): baseUrlEnv 가 명시됐을 때만 포함(로컬을 함부로 가정하지 않음).
 */
export function specsFromEnv(env: Env = process.env): ModelSpec[] {
  const specs: ModelSpec[] = []
  for (const p of PRESETS) {
    const apiKey = p.keyEnv ? env[p.keyEnv] : undefined
    const baseURL = env[p.baseUrlEnv] || p.baseURL
    if (p.keyless) {
      if (!env[p.baseUrlEnv]) continue // 로컬은 명시적 opt-in
    } else if (!apiKey) {
      continue
    }
    const model = env[p.modelEnv] || p.defaultModel
    specs.push({
      id: `${p.provider}:${model}`,
      provider: p.provider,
      model,
      baseURL,
      apiKey: apiKey || 'not-needed', // ollama 등 keyless 는 더미 키 허용
    })
  }
  return specs
}

/** 스펙으로 LanguageModel 생성(OpenAI 호환 어댑터). 호출부는 provider 와 무관하게 동일하게 쓴다. */
export function buildModel(spec: ModelSpec): LanguageModel {
  const client = createOpenAICompatible({ name: spec.provider, baseURL: spec.baseURL, apiKey: spec.apiKey })
  return client(spec.model)
}

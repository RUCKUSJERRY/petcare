import type { ModelSpec } from './registry'

/**
 * 작업별 모델 라우팅 — "멀티모델 라우팅".
 *
 * 작업 성격에 맞는 provider 를 선호순으로 고른다. 분류/추출 같은 기계적 작업은 싸고 빠른
 * 오픈소스(groq 의 Llama 등)로, 상담(chat)은 한국어가 강한 모델(Solar 등)로 보내는 식.
 * 어떤 모델이 실제로 '가장 낫고 싼지'는 Eval(품질)+ai_events(비용)로 근거를 쌓아 정책을 고친다.
 *
 * 순수·결정적: 구성된 모델 목록(available)과 정책(policy)을 받아 하나를 고른다. 네트워크·env 접근 없음.
 */

export type AiTask = 'chat' | 'extract' | 'classify'

/** 작업별 provider 선호순. 앞쪽일수록 우선. */
export type RoutingPolicy = Record<AiTask, string[]>

/**
 * 기본 정책. chat 은 한국어 상담 품질 우선(upstage Solar), 그다음 상용 > 오픈소스.
 * extract/classify 는 비용/속도 우선(오픈소스 groq/together 를 앞에).
 * 목록에 없거나 구성 안 된 provider 는 건너뛰고, 아무 선호도 안 맞으면 구성된 것 중 첫 번째로 폴백.
 */
export const DEFAULT_POLICY: RoutingPolicy = {
  chat: ['upstage', 'openai', 'gemini', 'groq', 'together', 'openrouter', 'ollama'],
  extract: ['upstage', 'openai', 'gemini', 'groq', 'together', 'openrouter', 'ollama'],
  classify: ['groq', 'together', 'openrouter', 'ollama', 'upstage', 'openai', 'gemini'],
}

/**
 * 작업에 쓸 모델을 고른다.
 * @param task 작업 종류
 * @param available 구성된 모델들(specsFromEnv 결과)
 * @param policy 작업별 provider 선호순(기본 DEFAULT_POLICY)
 * @param override 특정 provider 강제(관리자 app_settings/env). 구성돼 있으면 최우선.
 * @returns 선택된 ModelSpec, 구성된 모델이 하나도 없으면 null
 */
export function selectModel(
  task: AiTask,
  available: ModelSpec[],
  policy: RoutingPolicy = DEFAULT_POLICY,
  override?: string | null,
): ModelSpec | null {
  if (available.length === 0) return null
  const firstByProvider = (provider: string) => available.find(s => s.provider === provider)

  // 1) override(강제 provider)가 구성돼 있으면 그걸 쓴다.
  if (override) {
    const forced = firstByProvider(override)
    if (forced) return forced
  }
  // 2) 작업별 선호순에서 구성된 첫 provider.
  for (const provider of policy[task] ?? []) {
    const hit = firstByProvider(provider)
    if (hit) return hit
  }
  // 3) 폴백: 구성된 것 중 첫 번째(결정적).
  return available[0]
}

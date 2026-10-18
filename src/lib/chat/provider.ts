import type { LanguageModel } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppSetting } from '@/lib/settings'
import { buildModel, specsFromEnv } from '@/lib/ai/models/registry'
import { selectModel } from '@/lib/ai/models/routing'

/**
 * 챗봇 LLM provider 선택.
 *
 * 모델 레지스트리(env 로 구성된 OpenAI 호환 provider들)와 작업별 라우팅 위에 얹는다.
 * - 'chat' 작업 선호순(라우팅 정책)으로 구성된 모델 중 하나를 고른다.
 * - app_settings.chat_provider(관리자) 또는 env CHAT_PROVIDER 로 특정 provider 를 강제할 수 있다
 *   (override — 구성돼 있으면 최우선). 기존 배포(UPSTAGE_API_KEY 만 설정)에서는 upstage 가 선택돼
 *   동작이 그대로 유지된다.
 * - 비밀키는 env 에만(DB 금지). 키가 없으면 그 provider 는 '구성 안 됨'으로 빠진다.
 *
 * provider/model 이름을 함께 돌려줘 텔레메트리(ai_events)에 어느 모델로 호출했는지 남긴다.
 */
export interface ResolvedChatModel {
  model: LanguageModel
  provider: string
  modelName: string
}

export async function resolveChatModel(client: SupabaseClient): Promise<ResolvedChatModel | null> {
  const available = specsFromEnv()
  const override = (await getAppSetting(client, 'chat_provider')) || process.env.CHAT_PROVIDER || null
  const spec = selectModel('chat', available, undefined, override)
  if (!spec) return null
  return { model: buildModel(spec), provider: spec.provider, modelName: spec.model }
}

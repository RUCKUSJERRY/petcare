import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppSetting } from '@/lib/settings'

/**
 * 챗봇 LLM provider 추상화.
 *
 * 어떤 provider 를 쓸지는 app_settings.chat_provider(관리자) → env CHAT_PROVIDER → 기본 'upstage'
 * 순으로 정한다. API 키(시크릿)는 DB 가 아니라 env 에만 둔다(OCR 과 동일 원칙).
 *
 * 현재는 Upstage(Solar, OpenAI 호환)만 구현했다. OpenAI/Anthropic/Gemini 는 다음 단계에서
 * 각 @ai-sdk/* 어댑터를 이 switch 에 추가하면 된다(호출부 route 는 그대로 — 모델 객체만 교체).
 *
 * resolveChatModel 은 모델 객체뿐 아니라 provider/model 이름도 함께 돌려준다 —
 * 텔레메트리(ai_events)에 '어느 provider·model 로 호출했는지'를 남기기 위함(옵저버빌리티·비용).
 */
export type ChatProvider = 'upstage' | 'openai' | 'anthropic' | 'gemini'

/** 선택된 챗 모델 + 텔레메트리/비용 집계에 쓸 provider·model 메타 */
export interface ResolvedChatModel {
  model: LanguageModel
  provider: ChatProvider
  modelName: string
}

function upstageModel(): ResolvedChatModel | null {
  const apiKey = process.env.UPSTAGE_API_KEY
  if (!apiKey) return null
  // Upstage(Solar)는 OpenAI '호환' 서드파티다. @ai-sdk/openai 의 기본 provider 는 OpenAI 전용
  // Responses API(/v1/responses)를 호출해 Upstage 가 400 을 준다 → 항상 Chat Completions 를
  // 쓰는 openai-compatible 어댑터로 연결한다(baseURL 뒤에 /chat/completions 를 붙임).
  const upstage = createOpenAICompatible({
    name: 'upstage',
    baseURL: process.env.UPSTAGE_CHAT_URL || 'https://api.upstage.ai/v1',
    apiKey,
  })
  const modelName = process.env.UPSTAGE_CHAT_MODEL || 'solar-pro2'
  return { model: upstage(modelName), provider: 'upstage', modelName }
}

/** 선택된 provider 의 언어모델(+메타)을 반환. 키 미설정 등으로 쓸 수 없으면 null. */
export async function resolveChatModel(client: SupabaseClient): Promise<ResolvedChatModel | null> {
  const provider = (await getAppSetting(client, 'chat_provider')) || process.env.CHAT_PROVIDER || 'upstage'
  switch (provider) {
    // case 'openai':    return openaiModel()      // 다음 단계
    // case 'anthropic': return anthropicModel()   // 다음 단계
    // case 'gemini':    return geminiModel()       // 다음 단계
    case 'upstage':
    default:
      return upstageModel()
  }
}

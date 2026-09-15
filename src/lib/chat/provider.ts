import { createOpenAI } from '@ai-sdk/openai'
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
 */
export type ChatProvider = 'upstage' | 'openai' | 'anthropic' | 'gemini'

function upstageModel(): LanguageModel | null {
  const apiKey = process.env.UPSTAGE_API_KEY
  if (!apiKey) return null
  // Upstage 는 OpenAI 호환이라 createOpenAI 로 baseURL 만 바꿔 쓴다(스캔 OCR 과 동일한 방식).
  const upstage = createOpenAI({
    baseURL: process.env.UPSTAGE_CHAT_URL || 'https://api.upstage.ai/v1',
    apiKey,
  })
  return upstage(process.env.UPSTAGE_CHAT_MODEL || 'solar-pro2')
}

/** 선택된 provider 의 언어모델을 반환. 키 미설정 등으로 쓸 수 없으면 null. */
export async function resolveChatModel(client: SupabaseClient): Promise<LanguageModel | null> {
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

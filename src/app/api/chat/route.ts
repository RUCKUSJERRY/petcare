import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUserPremiumServer } from '@/lib/plan'
import { getAppSetting } from '@/lib/settings'
import { resolveChatModel } from '@/lib/chat/provider'
import { buildSystemPrompt, type ChatPetContext } from '@/lib/chat/context'
import { todayKST } from '@/lib/utils'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// 남용 방지: 등급 무관 시간당 상한 + 무료 사용자 하루 상한(app_settings.free_chat_daily 로 조정).
const HOURLY_CAP = 60
const DEFAULT_FREE_CHAT_DAILY = 20

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // ── 사용량 제한 (ai_usage kind='chat') ──────────────────────────────
  // 카운트 조회 실패는 fail-open: 챗은 호출당 부담이 작아, 사용량 테이블 문제로 대화 자체가
  // 막히는 것보다 통과시키는 편이 낫다(OCR 의 유료 fail-closed 와 반대 방침).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: hourCount } = await supabase
    .from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('kind', 'chat').gte('created_at', hourAgo)
  if ((hourCount ?? 0) >= HOURLY_CAP) {
    return NextResponse.json({ error: 'rate_limited', message: '요청이 많아요. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }

  const premium = await isUserPremiumServer(supabase, user.id)
  if (!premium) {
    const raw = await getAppSetting(supabase, 'free_chat_daily')
    const parsed = raw != null ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN
    const dailyLimit = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FREE_CHAT_DAILY
    const dayStart = `${todayKST()}T00:00:00+09:00`
    const { count: dayCount } = await supabase
      .from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('kind', 'chat').gte('created_at', dayStart)
    if ((dayCount ?? 0) >= dailyLimit) {
      return NextResponse.json(
        { error: 'free_limit_reached', message: `오늘 무료 AI 대화(${dailyLimit}회)를 모두 썼어요. 프리미엄이면 무제한이에요.`, upsell: 'premium' },
        { status: 429 },
      )
    }
  }

  const model = await resolveChatModel(supabase)
  if (!model) {
    return NextResponse.json({ error: 'not_configured', message: 'AI 챗봇이 아직 설정되지 않았어요.' }, { status: 503 })
  }

  let messages: UIMessage[]
  try {
    const body = await req.json()
    messages = body?.messages
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  // 컨텍스트: 사용자의 반려동물 요약(멤버십 RLS 로 본인 아이만 조회됨)
  const { data: pets } = await supabase.from('pets').select('name, species, birth_year, birth_month')
  const system = buildSystemPrompt((pets ?? []) as ChatPetContext[])

  // 사용량 1건 기록(best-effort — 테이블 없거나 실패해도 대화는 진행)
  supabase.from('ai_usage').insert({ user_id: user.id, kind: 'chat' })
    .then(({ error }) => { if (error) console.error('[chat] usage insert failed', error) })

  const modelMessages = await convertToModelMessages(messages)
  const result = streamText({
    model,
    system,
    messages: modelMessages,
    temperature: 0.4,
  })
  return result.toUIMessageStreamResponse()
}

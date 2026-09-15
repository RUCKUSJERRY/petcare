import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUserPremiumServer } from '@/lib/plan'
import { getAppSetting } from '@/lib/settings'
import { resolveChatModel } from '@/lib/chat/provider'
import { buildSystemPrompt, type ChatPetContext } from '@/lib/chat/context'
import { buildChatTools } from '@/lib/chat/tools'
import { todayKST } from '@/lib/utils'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
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
  let threadId: string | undefined
  try {
    const body = await req.json()
    messages = body?.messages
    // 클라이언트가 대화 스레드 id 를 함께 보낸다(대화 저장용). 없으면 저장은 건너뛴다.
    threadId = typeof body?.threadId === 'string' ? body.threadId : (typeof body?.id === 'string' ? body.id : undefined)
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  // 컨텍스트: 사용자의 반려동물 요약(멤버십 RLS 로 본인 아이만 조회됨). id 는 도구(기록 생성)에 필요.
  const { data: pets } = await supabase.from('pets').select('id, name, species, birth_year, birth_month')
  const petRows = (pets ?? []) as Array<{ id: string; name: string } & ChatPetContext>
  const system = buildSystemPrompt(petRows as ChatPetContext[])
  const tools = buildChatTools(supabase, petRows.map(p => ({ id: p.id, name: p.name })))

  // 사용량 1건 기록(best-effort — 테이블 없거나 실패해도 대화는 진행)
  supabase.from('ai_usage').insert({ user_id: user.id, kind: 'chat' })
    .then(({ error }) => { if (error) console.error('[chat] usage insert failed', error) })

  // ── 대화 저장(2단계) — 모두 best-effort. 테이블 미적용/실패해도 스트리밍은 정상 진행 ──
  const lastMsg = messages[messages.length - 1]
  const userText = lastMsg?.role === 'user' ? uiMessageText(lastMsg) : ''
  if (threadId) {
    try {
      // 첫 사용자 메시지면 스레드 제목을 만든다(그 메시지 앞부분).
      const isFirstTurn = messages.filter(m => m.role === 'user').length === 1
      await supabase.from('chat_threads').upsert(
        {
          id: threadId,
          user_id: user.id,
          updated_at: new Date().toISOString(),
          ...(isFirstTurn && userText ? { title: userText.slice(0, 40) } : {}),
        },
        { onConflict: 'id' },
      )
      if (userText) {
        await supabase.from('chat_messages').insert({ thread_id: threadId, user_id: user.id, role: 'user', content: userText })
      }
    } catch (e) {
      console.error('[chat] persist user failed', e)
    }
  }

  const modelMessages = await convertToModelMessages(messages)
  const result = streamText({
    model,
    system,
    messages: modelMessages,
    temperature: 0.4,
    tools,
    // 도구 호출 후 그 결과로 최종 답변까지 이어가도록 여러 스텝 허용(무한루프 방지 상한).
    stopWhen: stepCountIs(5),
    // 응답 완료 시 어시스턴트 메시지 저장 + 스레드 갱신(best-effort)
    onFinish: async ({ text }) => {
      if (!threadId || !text) return
      try {
        await supabase.from('chat_messages').insert({ thread_id: threadId, user_id: user.id, role: 'assistant', content: text })
        await supabase.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
      } catch (e) {
        console.error('[chat] persist assistant failed', e)
      }
    },
  })
  return result.toUIMessageStreamResponse()
}

/** UIMessage 의 텍스트 파트만 이어붙인다. */
function uiMessageText(m: UIMessage): string {
  const parts = (m.parts ?? []) as Array<{ type: string; text?: string }>
  return parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('')
}

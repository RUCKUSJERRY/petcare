import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { cronAuthError, kstDate } from '@/lib/cron'
import { getDailyTip } from '@/lib/dailyTip'
import type { Species } from '@/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 데일리 케어 팁 푸시 (Vercel Cron 일일 호출용).
 * - tip_push_enabled=true 로 명시적으로 옵트인한 사용자에게만 발송.
 * - CRON_SECRET 으로 보호. tip_push_last_on 으로 당일 중복 발송 방지.
 * - 팁 콘텐츠는 홈의 '오늘의 케어 팁'과 동일한 결정적 데이터(dailyTip)를 재사용 → 같은 날 동일 팁.
 */
export async function GET(req: Request) {
  const authErr = cronAuthError(req, 'daily-tip')
  if (authErr) return authErr

  // 서버 cron 은 UTC 로 동작하므로 KST 달력 기준 '오늘'을 계산(팁 선택·중복 방지 키 일치).
  const today = kstDate(0)
  // 테스트용: ?force=1 이면 당일 중복 방지를 무시하고 재발송
  const force = new URL(req.url).searchParams.get('force') === '1'

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 옵트인 사용자 조회 → 당일 미발송만 대상으로 추림
  const { data: profs, error } = await admin
    .from('profiles')
    .select('id, tip_push_last_on')
    .eq('tip_push_enabled', true)
  if (error) {
    console.error('[daily-tip] profiles select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targets = (profs ?? []).filter(
    (p: { id: string; tip_push_last_on: string | null }) =>
      force || !p.tip_push_last_on || p.tip_push_last_on < today,
  )
  if (targets.length === 0) {
    const result = { processed: 0, sent: 0, force }
    console.log('[daily-tip]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  const userIds = targets.map(p => p.id)

  // 사용자별 대표 종(보유 반려동물 다수 종; 없으면 dog) — 팁 풀 선택에 사용.
  const { data: pets } = await admin
    .from('pets')
    .select('user_id, species')
    .in('user_id', userIds)
  const tally = new Map<string, { dog: number; cat: number }>()
  for (const p of (pets ?? []) as { user_id: string; species: Species }[]) {
    const t = tally.get(p.user_id) ?? { dog: 0, cat: 0 }
    t[p.species]++
    tally.set(p.user_id, t)
  }
  const speciesOf = (uid: string): Species => {
    const t = tally.get(uid)
    return t && t.cat > t.dog ? 'cat' : 'dog'
  }

  let sent = 0
  for (const uid of userIds) {
    const tip = getDailyTip(speciesOf(uid), today)
    if (!tip) continue
    await sendPushToUser(uid, {
      title: '💡 오늘의 케어 팁',
      body: tip.text,
      url: tip.href,
      tag: `daily-tip-${today}`,
    })
    sent++
    // 당일 중복 발송 방지 플래그. 갱신 실패 시 다음 cron 에서 중복 푸시가 갈 수 있어 로그로 남긴다.
    const { error: markErr } = await admin
      .from('profiles').update({ tip_push_last_on: today }).eq('id', uid)
    if (markErr) console.error('[daily-tip] last_on update failed', uid, markErr.message)
  }

  const result = { processed: targets.length, sent, force }
  console.log('[daily-tip]', JSON.stringify(result))
  return NextResponse.json(result)
}

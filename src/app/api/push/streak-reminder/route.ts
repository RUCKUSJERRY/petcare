import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { computeLogStreak } from '@/lib/utils'
import { DAILY_LOG_CATEGORIES } from '@/lib/records'
import { cronAuthError } from '@/lib/cron'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 연속을 계산할 때 거슬러 올라갈 최대 창(일). 이보다 긴 연속은 이 값으로 표시되지만
// "연속을 이어가자"는 리마인더 목적에는 충분하다. (쿼리 행 수를 합리적으로 제한)
const STREAK_WINDOW_DAYS = 60

/**
 * 연속 기록(streak) 리마인더 푸시 (Vercel Cron — 저녁 1회 호출용).
 *
 * 진행 중인 연속 기록(2일 이상)이 있는데 아직 '오늘' 생활기록이 없는 사용자에게
 * "연속이 끊기기 전에 오늘도 기록하세요" 푸시를 보낸다.
 * - streak_push_enabled=true 로 옵트인한 사용자만 대상.
 * - CRON_SECRET 으로 보호. streak_push_last_on 으로 당일 중복 발송 방지.
 * - 연속·오늘기록 판정은 홈 요약 카드와 동일한 순수 로직(computeLogStreak)을 재사용한다.
 */
export async function GET(req: Request) {
  const authErr = cronAuthError(req, 'streak-reminder')
  if (authErr) return authErr

  // 기록 날짜(event_on)는 작성자 로컬(KST) 달력 기준 → 서버(UTC) cron 에서도 KST '오늘'을 쓴다.
  const kstDate = (offsetDays = 0) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })
      .format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
  const today = kstDate(0)
  const since = kstDate(-STREAK_WINDOW_DAYS)
  const force = new URL(req.url).searchParams.get('force') === '1'

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 1) 옵트인 사용자 → 당일 미발송만 대상으로 추림
  const { data: profs, error: profErr } = await admin
    .from('profiles')
    .select('id, streak_push_last_on')
    .eq('streak_push_enabled', true)
  if (profErr) {
    console.error('[streak-reminder] profiles select error:', profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  const targetUserIds = (profs ?? [])
    .filter((p: { id: string; streak_push_last_on: string | null }) =>
      force || !p.streak_push_last_on || p.streak_push_last_on < today)
    .map(p => p.id)
  if (targetUserIds.length === 0) {
    const result = { processed: 0, sent: 0, force }
    console.log('[streak-reminder]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 2) 대상 사용자가 돌보는 반려동물(공동 관리 포함) — pet_members 기준
  const { data: members, error: memErr } = await admin
    .from('pet_members')
    .select('pet_id, user_id')
    .in('user_id', targetUserIds)
  if (memErr) {
    console.error('[streak-reminder] members select error:', memErr)
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }
  const petIdsByUser = new Map<string, string[]>()
  for (const m of (members ?? []) as { pet_id: string; user_id: string }[]) {
    const list = petIdsByUser.get(m.user_id) ?? []
    list.push(m.pet_id)
    petIdsByUser.set(m.user_id, list)
  }
  const allPetIds = Array.from(new Set((members ?? []).map(m => m.pet_id as string)))
  if (allPetIds.length === 0) {
    const result = { processed: targetUserIds.length, sent: 0, force }
    console.log('[streak-reminder]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 3) 반려동물별 생활기록 날짜 집합 + 이름
  const [{ data: recs, error: recErr }, { data: pets }] = await Promise.all([
    admin.from('records').select('pet_id, event_on')
      .in('pet_id', allPetIds)
      .in('category', DAILY_LOG_CATEGORIES)
      .gte('event_on', since),
    admin.from('pets').select('id, name').in('id', allPetIds),
  ])
  if (recErr) {
    console.error('[streak-reminder] records select error:', recErr)
    return NextResponse.json({ error: recErr.message }, { status: 500 })
  }
  const nameById = new Map((pets ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
  const datesByPet = new Map<string, Set<string>>()
  for (const r of (recs ?? []) as { pet_id: string; event_on: string }[]) {
    let set = datesByPet.get(r.pet_id)
    if (!set) { set = new Set(); datesByPet.set(r.pet_id, set) }
    set.add(r.event_on)
  }

  // 4) 사용자별로 '진행 중이지만 오늘 미기록'인 최장 연속을 찾아 알림
  let sent = 0
  let processed = 0
  for (const uid of targetUserIds) {
    processed++
    const petIds = petIdsByUser.get(uid) ?? []
    let best: { name: string; streak: number } | null = null
    for (const pid of petIds) {
      const set = datesByPet.get(pid)
      if (!set || set.has(today)) continue // 오늘 이미 기록 → 연속 유지됨(위험 아님)
      const streak = computeLogStreak(set, today)
      if (streak >= 2 && (!best || streak > best.streak)) {
        best = { name: nameById.get(pid) ?? '', streak }
      }
    }

    // 발송 대상이 있을 때만 발송하고, 그 때만 당일 플래그를 찍는다.
    // (위험한 연속이 없으면 재방문할 이유가 없으므로 알림을 보내지 않는다.)
    if (best) {
      const petName = best.name ? `${best.name} ` : ''
      await sendPushToUser(uid, {
        title: `🔥 ${best.streak}일 연속 기록 중이에요`,
        body: `${petName}오늘 기록하면 ${best.streak + 1}일! 연속이 끊기기 전에 이어가 볼까요?`,
        url: '/dashboard',
        tag: `streak-${today}`,
      })
      sent++
      const { error: markErr } = await admin
        .from('profiles').update({ streak_push_last_on: today }).eq('id', uid)
      if (markErr) console.error('[streak-reminder] last_on update failed', uid, markErr.message)
    }
  }

  const result = { processed, sent, force }
  console.log('[streak-reminder]', JSON.stringify(result))
  return NextResponse.json(result)
}

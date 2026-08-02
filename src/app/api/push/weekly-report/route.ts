import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { cronAuthError, kstDate } from '@/lib/cron'
import { computeWeeklyRecap, hasRecapActivity, type RecapRecord, type RecapWalk } from '@/lib/weeklyRecap'
import { formatDistance, formatWon, isoToKstDate } from '@/lib/utils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 주간 리포트 푸시 (Vercel Cron — 주 1회, 일요일 저녁 호출용).
 *
 * 옵트인(weekly_report_push_enabled=true)한 사용자에게 최근 7일 활동 요약
 * (산책·기록·지출·함께한 날)을 푸시로 보낸다. 재방문·리텐션 유도가 목적.
 * - CRON_SECRET 으로 보호. weekly_report_push_last_on 으로 한 주 중복 발송 방지.
 * - 요약 집계는 홈 '이번 주 리포트' 카드와 동일한 순수 로직(computeWeeklyRecap)을 재사용한다.
 * - 최근 7일 활동이 전혀 없는 사용자에겐 보내지 않는다(빈 요약 방지).
 */
export async function GET(req: Request) {
  const authErr = cronAuthError(req, 'weekly-report')
  if (authErr) return authErr

  // 기록 날짜(event_on)는 작성자 로컬(KST) 달력 기준 → 서버(UTC) cron 에서도 KST 기준을 쓴다.
  const today = kstDate(0)
  const weekStart = kstDate(-6) // 오늘 포함 최근 7일
  const weekStartIso = `${weekStart}T00:00:00+09:00` // 산책 started_at(timestamptz) KST 경계
  const force = new URL(req.url).searchParams.get('force') === '1'

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 1) 옵트인 사용자 → 이번 주 미발송만 대상으로 추림 (last_on 이 최근 6일 이내면 이미 발송)
  const { data: profs, error: profErr } = await admin
    .from('profiles')
    .select('id, weekly_report_push_last_on')
    .eq('weekly_report_push_enabled', true)
  if (profErr) {
    console.error('[weekly-report] profiles select error:', profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  const targetUserIds = (profs ?? [])
    .filter((p: { id: string; weekly_report_push_last_on: string | null }) =>
      force || !p.weekly_report_push_last_on || p.weekly_report_push_last_on < weekStart)
    .map(p => p.id)
  if (targetUserIds.length === 0) {
    const result = { processed: 0, sent: 0, force }
    console.log('[weekly-report]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 2) 대상 사용자가 돌보는 반려동물(공동 관리 포함) — pet_members 기준
  const { data: members, error: memErr } = await admin
    .from('pet_members')
    .select('pet_id, user_id')
    .in('user_id', targetUserIds)
  if (memErr) {
    console.error('[weekly-report] members select error:', memErr)
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
    console.log('[weekly-report]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 3) 최근 7일 산책·기록을 반려동물별로 모아둔다 (기간으로 걸러 가볍게 조회)
  const [{ data: walks, error: walkErr }, { data: recs, error: recErr }] = await Promise.all([
    admin.from('walks').select('pet_id, duration_s, distance_m, started_at')
      .in('pet_id', allPetIds).gte('started_at', weekStartIso),
    // event_on 은 사용자가 고르는 값이라 미래 날짜(예정 진료·미리 입력한 기록)일 수 있다.
    // 상한(오늘)을 두지 않으면 이번 주 지출·기록·함께한 날이 미래 기록으로 부풀려진다.
    // (산책은 started_at 절대시각으로 걸러 이미 안전 — 기록 쪽만 상한을 건다.)
    admin.from('records').select('pet_id, category, cost, event_on')
      .in('pet_id', allPetIds).gte('event_on', weekStart).lte('event_on', today),
  ])
  if (walkErr || recErr) {
    console.error('[weekly-report] activity select error:', walkErr ?? recErr)
    return NextResponse.json({ error: (walkErr ?? recErr)!.message }, { status: 500 })
  }
  const walksByPet = new Map<string, RecapWalk[]>()
  for (const w of (walks ?? []) as ({ pet_id: string; started_at: string } & RecapWalk)[]) {
    const list = walksByPet.get(w.pet_id) ?? []
    // started_at(절대시각)을 KST 날짜로 변환해 '산책만 한 날'도 함께한 날 수에 포함되게 한다.
    list.push({ duration_s: w.duration_s, distance_m: w.distance_m, dateKst: isoToKstDate(w.started_at) })
    walksByPet.set(w.pet_id, list)
  }
  const recsByPet = new Map<string, RecapRecord[]>()
  for (const r of (recs ?? []) as ({ pet_id: string } & RecapRecord)[]) {
    const list = recsByPet.get(r.pet_id) ?? []
    list.push({ category: r.category, cost: r.cost, event_on: r.event_on })
    recsByPet.set(r.pet_id, list)
  }

  // 4) 사용자별 요약(본인이 돌보는 모든 아이 합산) → 활동이 있으면 발송
  let sent = 0
  let processed = 0
  for (const uid of targetUserIds) {
    processed++
    const petIds = petIdsByUser.get(uid) ?? []
    const walkList: RecapWalk[] = []
    const recList: RecapRecord[] = []
    for (const pid of petIds) {
      walkList.push(...(walksByPet.get(pid) ?? []))
      recList.push(...(recsByPet.get(pid) ?? []))
    }
    const recap = computeWeeklyRecap(walkList, recList)
    if (!hasRecapActivity(recap)) continue // 이번 주 활동 없음 → 보내지 않음

    // 본문: 대표 지표 몇 개를 자연스럽게 묶는다. (0인 지표는 생략)
    const parts: string[] = []
    if (recap.walkCount > 0) parts.push(`산책 ${recap.walkCount}회(${formatDistance(recap.distanceM)})`)
    if (recap.logCount > 0) parts.push(`기록 ${recap.logCount}건`)
    if (recap.spend > 0) parts.push(`지출 ${formatWon(recap.spend)}`)
    const summary = parts.join(' · ')
    const days = recap.activeDays

    await sendPushToUser(uid, {
      title: '🐾 이번 주 리포트가 도착했어요',
      body: `${summary}${summary ? ' · ' : ''}${days}일 함께 기록했어요. 이번 주도 수고했어요!`,
      url: '/dashboard',
      tag: `weekly-${today}`,
    })
    sent++
    const { error: markErr } = await admin
      .from('profiles').update({ weekly_report_push_last_on: today }).eq('id', uid)
    if (markErr) console.error('[weekly-report] last_on update failed', uid, markErr.message)
  }

  const result = { processed, sent, force }
  console.log('[weekly-report]', JSON.stringify(result))
  return NextResponse.json(result)
}

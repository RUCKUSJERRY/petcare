import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { cronAuthError } from '@/lib/cron'
import { anniversariesToday, formatAnniversaryPush, type AnniversaryPushItem } from '@/lib/anniversary'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 생일·입양 기념일 축하 푸시 (Vercel Cron — 오전 1회 호출용).
 *
 * 오늘(KST)이 생일 또는 입양 기념일(만 1주년 이상)인 아이가 있는 보호자에게 축하 푸시를 보낸다.
 * - anniversary_push_enabled=true 로 옵트인한 사용자만 대상.
 * - CRON_SECRET 으로 보호. anniversary_push_last_on 으로 당일 중복 발송 방지.
 * - 기념일 판정은 홈 배지와 동일한 순수 로직(anniversariesToday)을 재사용한다.
 * - 한 보호자에게 여러 아이가 겹치면 푸시 1건으로 묶어 보낸다.
 */
export async function GET(req: Request) {
  const authErr = cronAuthError(req, 'anniversary-reminder')
  if (authErr) return authErr

  // 생일/입양일은 보호자 로컬(KST) 달력 기준 → 서버(UTC) cron 에서도 KST '오늘'을 쓴다.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
  // 테스트용: ?force=1 이면 당일 중복 방지(anniversary_push_last_on)를 무시하고 재발송
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
    .select('id, anniversary_push_last_on')
    .eq('anniversary_push_enabled', true)
  if (profErr) {
    console.error('[anniversary-reminder] profiles select error:', profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  const targetUserIds = (profs ?? [])
    .filter((p: { id: string; anniversary_push_last_on: string | null }) =>
      force || !p.anniversary_push_last_on || p.anniversary_push_last_on < today)
    .map(p => p.id)
  if (targetUserIds.length === 0) {
    const result = { processed: 0, sent: 0, force }
    console.log('[anniversary-reminder]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 2) 대상 사용자가 돌보는 반려동물(공동 관리 포함) — pet_members 기준
  const { data: members, error: memErr } = await admin
    .from('pet_members')
    .select('pet_id, user_id')
    .in('user_id', targetUserIds)
  if (memErr) {
    console.error('[anniversary-reminder] members select error:', memErr)
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
    console.log('[anniversary-reminder]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 3) 반려동물별 생일/입양일 정보
  const { data: pets, error: petErr } = await admin
    .from('pets')
    .select('id, name, birth_year, birth_month, birth_day, adopted_on')
    .in('id', allPetIds)
  if (petErr) {
    console.error('[anniversary-reminder] pets select error:', petErr)
    return NextResponse.json({ error: petErr.message }, { status: 500 })
  }
  type PetRow = {
    id: string; name: string
    birth_year: number | null; birth_month: number | null; birth_day: number | null
    adopted_on: string | null
  }
  const petById = new Map<string, PetRow>((pets ?? []).map((p: PetRow) => [p.id, p]))

  // 4) 사용자별로 오늘 축하할 아이들을 모아 푸시 1건으로 발송
  let sent = 0
  let processed = 0
  for (const uid of targetUserIds) {
    processed++
    const items: AnniversaryPushItem[] = []
    // 같은 아이가 공동 관리로 중복될 수 있으니 pet_id 중복 제거
    for (const pid of Array.from(new Set(petIdsByUser.get(uid) ?? []))) {
      const pet = petById.get(pid)
      if (!pet) continue
      for (const ev of anniversariesToday(pet, today)) {
        items.push({ name: pet.name, kind: ev.kind, years: ev.years })
      }
    }

    const msg = formatAnniversaryPush(items)
    // 축하할 기념일이 있을 때만 발송하고, 그 때만 당일 플래그를 찍는다.
    if (msg) {
      await sendPushToUser(uid, {
        title: msg.title,
        body: msg.body,
        url: '/dashboard',
        tag: `anniversary-${today}`,
      })
      sent++
      const { error: markErr } = await admin
        .from('profiles').update({ anniversary_push_last_on: today }).eq('id', uid)
      if (markErr) console.error('[anniversary-reminder] last_on update failed', uid, markErr.message)
    }
  }

  const result = { processed, sent, force }
  console.log('[anniversary-reminder]', JSON.stringify(result))
  return NextResponse.json(result)
}

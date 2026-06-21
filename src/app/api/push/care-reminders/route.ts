import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { careCategoryIcon, ddayBadge } from '@/lib/utils'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 건강 일정 D-day 리마인더 (Vercel Cron 일일 호출용).
 * 오늘~내일(D-day, D-1) 예정 건강 기록의 보호자에게 푸시.
 * CRON_SECRET 으로 보호. 같은 날 중복 발송은 last_reminded_on 으로 방지.
 */
export async function GET(req: Request) {
  // Vercel Cron은 CRON_SECRET이 설정되면 Authorization: Bearer <secret> 헤더를 보냄
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // 기록의 날짜(next_due_on 등)는 작성자 브라우저의 로컬(KST) 달력 날짜로 저장된다.
  // 서버 cron은 UTC로 동작하므로, 시차로 D-day가 하루 어긋나지 않도록 KST 기준 오늘/내일을 계산한다.
  const kstDate = (offsetDays = 0) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })
      .format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
  const today = kstDate(0)
  const tomorrow = kstDate(1)
  // 테스트용: ?force=1 이면 당일 중복 방지(last_reminded_on)를 무시하고 재발송
  const force = new URL(req.url).searchParams.get('force') === '1'

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 오늘~내일 예정 (+ force가 아니면 오늘 아직 리마인드 안 한 것만)
  let query = admin
    .from('records')
    .select('id, pet_id, category, title, next_due_on, last_reminded_on, pet:pets(user_id, name)')
    .gte('next_due_on', today)
    .lte('next_due_on', tomorrow)
  if (!force) query = query.or(`last_reminded_on.is.null,last_reminded_on.lt.${today}`)
  const { data, error } = await query

  if (error) {
    console.error('[care-reminders] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    pet_id: string
    category: string
    title: string
    next_due_on: string
    pet: { user_id: string; name: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  // 공동 관리자(pet_members)에게도 발송하기 위해 반려동물별 구성원 user_id를 조회한다.
  // (소유자뿐 아니라 함께 돌보는 가족 전원이 D-day 알림을 받도록)
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const membersByPet = new Map<string, string[]>()
  if (petIds.length > 0) {
    const { data: members } = await admin
      .from('pet_members')
      .select('pet_id, user_id')
      .in('pet_id', petIds)
    for (const m of (members ?? []) as { pet_id: string; user_id: string }[]) {
      const list = membersByPet.get(m.pet_id) ?? []
      list.push(m.user_id)
      membersByPet.set(m.pet_id, list)
    }
  }

  let sent = 0
  for (const r of rows) {
    // 구성원 목록이 없으면(예외) 소유자에게 폴백
    const recipients = membersByPet.get(r.pet_id) ?? (r.pet?.user_id ? [r.pet.user_id] : [])
    if (recipients.length === 0) continue
    const petName = r.pet?.name ?? ''
    const badge = ddayBadge(r.next_due_on, today)
    for (const uid of recipients) {
      await sendPushToUser(uid, {
        title: `${careCategoryIcon(r.category)} 건강 일정 ${badge.text}`,
        body: `${petName} · ${r.category} (${r.title}) 예정일이 다가와요`,
        url: '/schedule',
        tag: `care-${r.id}`,
      })
      sent++
    }
    await admin.from('records').update({ last_reminded_on: today }).eq('id', r.id)
  }

  const result = { processed: rows.length, sent, force }
  console.log('[care-reminders]', JSON.stringify(result))
  return NextResponse.json(result)
}

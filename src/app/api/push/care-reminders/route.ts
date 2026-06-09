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

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 오늘~내일 예정 + 오늘 아직 리마인드 안 한 기록
  const { data, error } = await admin
    .from('vaccination_records')
    .select('id, category, vaccine_name, next_due_on, last_reminded_on, pet:pets(user_id, name)')
    .gte('next_due_on', today)
    .lte('next_due_on', tomorrow)
    .or(`last_reminded_on.is.null,last_reminded_on.lt.${today}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    category: string
    vaccine_name: string
    next_due_on: string
    pet: { user_id: string; name: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  let sent = 0
  for (const r of rows) {
    if (!r.pet?.user_id) continue
    const badge = ddayBadge(r.next_due_on)
    await sendPushToUser(r.pet.user_id, {
      title: `${careCategoryIcon(r.category)} 건강 일정 ${badge.text}`,
      body: `${r.pet.name} · ${r.category} (${r.vaccine_name}) 예정일이 다가와요`,
      url: '/schedule',
      tag: `care-${r.id}`,
    })
    await admin.from('vaccination_records').update({ last_reminded_on: today }).eq('id', r.id)
    sent++
  }

  return NextResponse.json({ processed: rows.length, sent })
}

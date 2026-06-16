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
    .select('id, category, title, next_due_on, last_reminded_on, pet:pets(user_id, name)')
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
    category: string
    title: string
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
      body: `${r.pet.name} · ${r.category} (${r.title}) 예정일이 다가와요`,
      url: '/schedule',
      tag: `care-${r.id}`,
    })
    await admin.from('records').update({ last_reminded_on: today }).eq('id', r.id)
    sent++
  }

  const result = { processed: rows.length, sent, force }
  console.log('[care-reminders]', JSON.stringify(result))
  return NextResponse.json(result)
}

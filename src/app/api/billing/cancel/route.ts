import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 구독 해지. 즉시 환불/중단이 아니라, 현재 결제 주기 끝까지 이용 후 갱신을 멈춘다.
 * (status='canceled' → 갱신 크론이 건너뜀. premium_until 까지는 프리미엄 유지)
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 500 })
  }

  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

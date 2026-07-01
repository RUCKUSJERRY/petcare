import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 현재 사용자의 구독 요약(민감정보 billing_key 제외)을 반환한다.
 * subscriptions 는 서버 전용 RLS라 service_role 로 읽되, 본인 행만 조회한다.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ subscription: null })
  }

  const { data, error } = await admin
    .from('subscriptions')
    .select('status, current_period_end, card_company, card_number_masked, amount, canceled_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // 조회 실패를 조용히 null(=구독 없음)로 돌려보내면 결제한 사용자가 구독 정보를 못 본다.
  // 권한 게이트는 profiles 기준이라 치명적이진 않지만, 운영자가 인지하도록 로그를 남긴다.
  if (error) console.error('[billing/me] subscription query failed', user.id, error.message)

  return NextResponse.json({ subscription: data ?? null })
}

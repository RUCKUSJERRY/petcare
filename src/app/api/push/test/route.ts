import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { NextResponse } from 'next/server'

/**
 * 자가 진단용: 현재 사용자에게 테스트 푸시를 보내고 설정 상태를 반환.
 * 어디서 막혔는지(키 미설정/구독 없음 등) 파악하는 용도.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const vapidConfigured = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    const serviceRoleConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    await sendPushToUser(user.id, {
      title: '펫케어 테스트 🔔',
      body: '푸시 알림이 정상적으로 동작해요!',
      url: '/dashboard',
      tag: 'push-test',
    })

    return NextResponse.json({
      vapidConfigured,
      serviceRoleConfigured,
      subscriptions: count ?? 0,
    })
  } catch (err) {
    console.error('[push/test] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}

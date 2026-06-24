import { createAdminClient } from '@/lib/supabase/admin'
import { addOneMonth, chargeBilling, TossError, tossConfigured } from '@/lib/toss'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 정기결제 자동 갱신 (Vercel Cron 일일 호출).
 * 결제 주기가 지난 active 구독을 빌링키로 청구하고 기간을 1개월 연장한다.
 *  - 성공: current_period_end·premium_until +1개월, 결제 이력(renewal) 적재
 *  - 실패: status='past_due' (premium_until 경과 시 자연 만료)
 * CRON_SECRET 으로 보호.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  if (!tossConfigured()) return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 })

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 500 })
  }

  const now = new Date()
  const { data, error } = await admin
    .from('subscriptions')
    .select('user_id, billing_key, customer_key, amount, current_period_end')
    .eq('status', 'active')
    .lte('current_period_end', now.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const subs = (data ?? []) as {
    user_id: string; billing_key: string; customer_key: string
    amount: number; current_period_end: string
  }[]

  let charged = 0, failed = 0
  for (const s of subs) {
    const orderId = `sub_renew_${s.user_id.replace(/-/g, '')}_${Date.now()}`
    try {
      const charge = await chargeBilling(s.billing_key, {
        customerKey: s.customer_key, amount: s.amount, orderId,
        orderName: '펫케어 프리미엄 (월 구독 갱신)',
      })
      // 만료일이 과거여도 끊김 없이 이어지도록 기존 만료일 기준으로 1개월 연장
      const base = new Date(s.current_period_end) > now ? new Date(s.current_period_end) : now
      const newEnd = addOneMonth(base)
      // 결제는 이미 성공했으므로, 이후 DB 반영 실패는 "돈은 빠졌는데 권한 미반영" 상태를
      // 만든다. 조용히 넘기지 말고 반드시 로그로 남겨 운영자가 수동 복구할 수 있게 한다.
      const { error: subErr } = await admin.from('subscriptions')
        .update({ current_period_end: newEnd.toISOString() })
        .eq('user_id', s.user_id)
      const { error: payErr } = await admin.from('payments').insert({
        user_id: s.user_id, order_id: charge.orderId, payment_key: charge.paymentKey,
        amount: s.amount, status: charge.status, method: charge.method ?? null, kind: 'renewal',
      })
      const { error: profErr } = await admin.from('profiles')
        .update({ plan: 'premium', premium_until: newEnd.toISOString() })
        .eq('id', s.user_id)
      if (subErr || payErr || profErr) {
        console.error('[billing/renew] charged but DB update failed', s.user_id, {
          orderId: charge.orderId, paymentKey: charge.paymentKey,
          subErr: subErr?.message, payErr: payErr?.message, profErr: profErr?.message,
        })
      }
      charged++
    } catch (err) {
      const msg = err instanceof TossError ? `${err.code}:${err.message}` : String(err)
      console.error('[billing/renew] charge failed', s.user_id, msg)
      await admin.from('subscriptions').update({ status: 'past_due' }).eq('user_id', s.user_id)
      failed++
    }
  }

  const result = { due: subs.length, charged, failed }
  console.log('[billing/renew]', JSON.stringify(result))
  return NextResponse.json(result)
}

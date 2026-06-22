import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addOneMonth, chargeBilling, customerKeyForUser, issueBillingKey, TossError, tossConfigured } from '@/lib/toss'
import { getPremiumPriceServer } from '@/lib/settings'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 카드 등록 인증(authKey) → 빌링키 발급 → 첫 달 청구 → 프리미엄 활성화.
 * 금액은 클라이언트 입력을 신뢰하지 않고 서버 가격(premiumPriceKRW)을 사용한다.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!tossConfigured()) return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 })

  let authKey: string | undefined
  try {
    authKey = (await req.json())?.authKey
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!authKey) return NextResponse.json({ error: 'authKey_required' }, { status: 400 })

  const customerKey = customerKeyForUser(user.id)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 500 })
  }

  // 가격은 운영설정(app_settings) 기준 — 클라이언트 입력을 신뢰하지 않는다.
  const amount = await getPremiumPriceServer(admin)

  try {
    // 1) 빌링키 발급
    const { billingKey, card } = await issueBillingKey(authKey, customerKey)

    // 2) 첫 달 청구
    const orderId = `sub_init_${user.id.replace(/-/g, '')}_${Date.now()}`
    const charge = await chargeBilling(billingKey, {
      customerKey, amount, orderId, orderName: '펫케어 프리미엄 (월 구독)',
      customerEmail: user.email,
    })

    // 3) 구독/결제 기록 + 프리미엄 활성화
    const periodEnd = addOneMonth(new Date())
    const { error: subErr } = await admin.from('subscriptions').upsert({
      user_id: user.id,
      status: 'active',
      billing_key: billingKey,
      customer_key: customerKey,
      card_company: card?.company ?? null,
      card_number_masked: card?.number ?? null,
      amount,
      current_period_end: periodEnd.toISOString(),
      canceled_at: null,
    }, { onConflict: 'user_id' })
    if (subErr) throw new Error(subErr.message)

    await admin.from('payments').insert({
      user_id: user.id,
      order_id: charge.orderId,
      payment_key: charge.paymentKey,
      amount,
      status: charge.status,
      method: charge.method ?? null,
      kind: 'initial',
    })

    await admin.from('profiles')
      .update({ plan: 'premium', premium_until: periodEnd.toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ ok: true, premiumUntil: periodEnd.toISOString() })
  } catch (err) {
    if (err instanceof TossError) {
      console.error('[billing/issue] toss error', err.status, err.code, err.message)
      return NextResponse.json({ error: 'payment_failed', message: err.message }, { status: 400 })
    }
    console.error('[billing/issue] error', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

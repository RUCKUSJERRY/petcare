import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addOneMonth, chargeBilling, customerKeyForUser, issueBillingKey, TossError, tossConfigured } from '@/lib/toss'
import { getPremiumPriceServer } from '@/lib/settings'
import { createHash } from 'crypto'
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
  if (typeof authKey !== 'string' || authKey.trim().length === 0 || authKey.length > 2000) {
    return NextResponse.json({ error: 'authKey_required' }, { status: 400 })
  }

  const customerKey = customerKeyForUser(user.id)

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 500 })
  }

  // 이미 활성 구독이 있으면 첫 달 결제를 다시 청구하지 않는다.
  // (중복 제출·응답 유실 후 재시도로 인한 이중청구와, premium_until 이 더 짧게 덮어써지는 것을 방지)
  const { data: existingSub } = await admin.from('subscriptions')
    .select('status, current_period_end').eq('user_id', user.id).maybeSingle()
  if (
    existingSub && existingSub.status === 'active' &&
    existingSub.current_period_end && new Date(existingSub.current_period_end) > new Date()
  ) {
    // 자가 복구: 직전 결제에서 subscriptions 는 활성이 됐으나 profiles 갱신만 실패해
    // "돈은 빠졌는데 프리미엄 미반영"으로 멈춘 사용자를, 재시도 시 여기서 되돌린다.
    // (프리미엄 판정 기준은 profiles.plan/premium_until 이므로 활성 구독과 항상 일치시킨다.)
    const { error: healErr } = await admin.from('profiles')
      .update({ plan: 'premium', premium_until: existingSub.current_period_end })
      .eq('id', user.id)
    if (healErr) console.error('[billing/issue] profile reconcile failed', user.id, healErr.message)
    return NextResponse.json(
      { error: 'already_subscribed', premiumUntil: existingSub.current_period_end },
      { status: 409 }
    )
  }

  // 가격은 운영설정(app_settings) 기준 — 클라이언트 입력을 신뢰하지 않는다.
  const amount = await getPremiumPriceServer(admin)

  try {
    // 1) 빌링키 발급
    const { billingKey, card } = await issueBillingKey(authKey, customerKey)

    // 2) 첫 달 청구
    // 멱등키: 같은 카드 등록 인증(authKey)에 대한 중복 제출·재시도는 동일한 orderId 가 되어
    // 토스(중복승인 거절)와 payments.order_id UNIQUE 제약이 함께 이중청구를 막는다.
    // (Date.now() 기반이면 더블클릭·응답유실 후 재시도마다 새 주문이 되어 멱등성이 깨져,
    //  위 '이미 활성 구독' 가드를 통과하는 동시요청이 카드를 두 번 청구할 수 있다.)
    const authFingerprint = createHash('sha256').update(authKey).digest('hex').slice(0, 16)
    const orderId = `sub_init_${user.id.replace(/-/g, '')}_${authFingerprint}`
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
    // 결제는 이미 성공했으므로, 이후 DB 반영 실패는 "돈은 빠졌는데 권한 미반영" 상태를
    // 만든다. subscriptions 기록 실패라도 throw 하지 말 것 — throw 하면 아래 payments 기록
    // 조차 남지 않아, 사용자가 재시도할 때 (중복 가드가 보는) subscriptions 행이 없어 그대로
    // 통과 → 이중청구로 이어진다. 대신 renew 경로와 동일하게 로그로만 남겨 운영자가 수동
    // 복구하게 한다. (돈은 빠졌는데 권한 미반영 가시화 원칙)
    const { error: payErr } = await admin.from('payments').insert({
      user_id: user.id,
      order_id: charge.orderId,
      payment_key: charge.paymentKey,
      amount,
      status: charge.status,
      method: charge.method ?? null,
      kind: 'initial',
    })

    // 프리미엄 권한의 실제 기준은 profiles.plan/premium_until 이므로 이 갱신이 가장 중요하다.
    const { error: profErr } = await admin.from('profiles')
      .update({ plan: 'premium', premium_until: periodEnd.toISOString() })
      .eq('id', user.id)

    if (subErr || payErr || profErr) {
      console.error('[billing/issue] charged but DB update failed', user.id, {
        orderId: charge.orderId, paymentKey: charge.paymentKey,
        subErr: subErr?.message, payErr: payErr?.message, profErr: profErr?.message,
      })
    }

    return NextResponse.json({ ok: true, premiumUntil: periodEnd.toISOString() })
  } catch (err) {
    if (err instanceof TossError) {
      // 같은 주문(멱등키)이 이미 승인된 경우 — 이중청구가 아니라 동시/중복 제출이다.
      // 앞선 요청이 이미 프리미엄을 활성화했으므로 실패가 아닌 중복으로 안내한다.
      if (err.code === 'ALREADY_PROCESSED_PAYMENT') {
        return NextResponse.json(
          { error: 'already_processing', message: '결제가 이미 처리됐어요. 잠시 후 새로고침해 주세요.' },
          { status: 409 }
        )
      }
      console.error('[billing/issue] toss error', err.status, err.code, err.message)
      return NextResponse.json({ error: 'payment_failed', message: err.message }, { status: 400 })
    }
    console.error('[billing/issue] error', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

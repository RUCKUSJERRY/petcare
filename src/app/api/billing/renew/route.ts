import { createAdminClient } from '@/lib/supabase/admin'
import { addOneMonth, chargeBilling, TossError, tossConfigured } from '@/lib/toss'
import { cronAuthError } from '@/lib/cron'
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
  const authErr = cronAuthError(req, 'billing/renew')
  if (authErr) return authErr
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
    // 멱등키: orderId 를 결제 주기(current_period_end)에 고정한다. 같은 주기에 대한
    // 재시도는 항상 동일한 orderId 가 되어 토스(중복승인 거절)와 payments.order_id UNIQUE
    // 제약이 함께 이중청구를 막는다. (Date.now() 기반이면 매 시도가 새 주문이라 멱등성이 깨짐)
    const periodStamp = new Date(s.current_period_end).toISOString().slice(0, 10).replace(/-/g, '')
    const orderId = `sub_renew_${s.user_id.replace(/-/g, '')}_${periodStamp}`
    let charge
    try {
      charge = await chargeBilling(s.billing_key, {
        customerKey: s.customer_key, amount: s.amount, orderId,
        orderName: '펫케어 프리미엄 (월 구독 갱신)',
      })
    } catch (err) {
      // 이미 이 주기에 청구가 성공했으나 직전 실행에서 DB 반영만 실패한 경우:
      // 토스가 동일 orderId 를 '이미 처리됨'으로 거절한다 → 중복청구가 아니라 복구 대상이다.
      // 새로 청구하지 말고 기존 결제 이력을 재사용해 DB 정합만 맞춘다.
      if (err instanceof TossError && err.code === 'ALREADY_PROCESSED_PAYMENT') {
        const { data: prev } = await admin.from('payments')
          .select('payment_key, status, method').eq('order_id', orderId).maybeSingle()
        charge = {
          orderId, paymentKey: prev?.payment_key ?? '',
          status: prev?.status ?? 'DONE', method: prev?.method ?? undefined,
          totalAmount: s.amount,
        }
      } else {
        const msg = err instanceof TossError ? `${err.code}:${err.message}` : String(err)
        console.error('[billing/renew] charge failed', s.user_id, msg)
        // 토스가 코드와 함께 명시적으로 거절한 경우(카드 한도·정지·유효기간 만료 등 실제 실패)에만
        // past_due 로 내린다. 네트워크/타임아웃/5xx 처럼 code 없는 일시적 오류는 구독을 active 로
        // 두어 다음날 크론이 재시도하게 한다 — 토스 일시 장애로 유효한 카드가 대량 해지되어
        // premium_until 경과로 조용히 만료되는 사고를 막는다. (active 이지만 premium_until 이
        // 지나면 자연 만료되고, 다음 크론이 같은 주기를 재청구한다.)
        const definiteDecline = err instanceof TossError && !!err.code
        if (definiteDecline) {
          await admin.from('subscriptions').update({ status: 'past_due' }).eq('user_id', s.user_id)
        }
        failed++
        continue
      }
    }

    // 기존 만료일 기준으로 1개월 연장 → 크론이 몇 시간·하루 늦게 돌아도 결제 주기(청구 기준일)가
    // 밀리지 않는다(주기 드리프트 방지). 다만 장기 미청구 등으로 연장분이 여전히 과거면 최소
    // '지금+1개월'로 잡아 프리미엄이 곧바로 유효하도록 한다.
    let newEnd = addOneMonth(new Date(s.current_period_end))
    if (newEnd <= now) newEnd = addOneMonth(now)
    // 결제는 이미 성공했으므로, 이후 DB 반영 실패는 "돈은 빠졌는데 권한 미반영" 상태를
    // 만든다. 조용히 넘기지 말고 반드시 로그로 남겨 운영자가 수동 복구할 수 있게 한다.
    //
    // 쓰기 순서가 자가복구의 핵심이다: subscriptions.current_period_end 는 반드시 '마지막'에
    // 전진시킨다. 이 값이 먼저 미래로 넘어가 버리면 다음 크론의 선택 필터(.lte(current_period_end,
    // now))에 다시 잡히지 않아, profiles 갱신이 실패했을 때 premium_until 이 과거인 채로 남아
    // 프리미엄이 조용히 사라진다. 반대로 current_period_end 를 마지막에 두면, 앞선 어떤 단계가
    // 실패해도 이 행은 계속 '만료' 상태로 재선택되어 ALREADY_PROCESSED_PAYMENT 복구 경로를 타고
    // DB 정합이 자동으로 맞춰진다. (billing/issue 의 자가복구와 동일한 원리)
    //
    // 멱등키(order_id)로 upsert — 재시도(복구) 시 중복 결제 이력이 쌓이지 않는다.
    const { error: payErr } = await admin.from('payments').upsert({
      user_id: s.user_id, order_id: charge.orderId, payment_key: charge.paymentKey,
      amount: s.amount, status: charge.status, method: charge.method ?? null, kind: 'renewal',
    }, { onConflict: 'order_id', ignoreDuplicates: true })
    const { error: profErr } = await admin.from('profiles')
      .update({ plan: 'premium', premium_until: newEnd.toISOString() })
      .eq('id', s.user_id)
    // 프리미엄 권한(profiles)이 반영된 뒤에야 결제 주기를 전진시켜 재선택 대상에서 뺀다.
    const { error: subErr } = await admin.from('subscriptions')
      .update({ current_period_end: newEnd.toISOString() })
      .eq('user_id', s.user_id)
    if (subErr || payErr || profErr) {
      console.error('[billing/renew] charged but DB update failed', s.user_id, {
        orderId: charge.orderId, paymentKey: charge.paymentKey,
        subErr: subErr?.message, payErr: payErr?.message, profErr: profErr?.message,
      })
    }
    charged++
  }

  const result = { due: subs.length, charged, failed }
  console.log('[billing/renew]', JSON.stringify(result))
  return NextResponse.json(result)
}

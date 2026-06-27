import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 관리자 전용 수익화 통계 (제휴 클릭·결제·구독). service_role로 집계하되 관리자만 접근. */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 500 })
  }

  // 관리자 검증
  const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const nowIso = new Date().toISOString()
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const countOf = async (table: string, build?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = admin.from(table).select('*', { count: 'exact', head: true })
    if (build) q = build(q)
    const { count } = await q
    return count ?? 0
  }

  // 제휴 클릭
  const affiliateTotal = await countOf('affiliate_clicks')
  const affiliate7d = await countOf('affiliate_clicks', q => q.gte('created_at', since7))

  // 구독 상태별
  const subsActive = await countOf('subscriptions', q => q.eq('status', 'active'))
  const subsCanceled = await countOf('subscriptions', q => q.eq('status', 'canceled'))
  const subsPastDue = await countOf('subscriptions', q => q.eq('status', 'past_due'))

  // 결제: 건수 + 누적 매출
  const { data: pays } = await admin.from('payments').select('amount').limit(10000)
  const paymentsCount = pays?.length ?? 0
  const revenue = (pays ?? []).reduce((s, p) => s + (p.amount as number), 0)

  // ── 투자자용 핵심 지표 ──────────────────────────────────────
  // 사용자 규모·성장
  const totalUsers = await countOf('profiles')
  const newUsers7d = await countOf('profiles', q => q.gte('created_at', since7))
  const newUsers30d = await countOf('profiles', q => q.gte('created_at', since30))
  // 유효 프리미엄(만료 전): plan='premium' & (무기한 or 만료일 미래)
  const premiumUsers = await countOf('profiles', q =>
    q.eq('plan', 'premium').or(`premium_until.is.null,premium_until.gt.${nowIso}`))
  // 전환율(%) = 유효 프리미엄 / 전체
  const conversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0
  // 최근 30일 매출 + 결제 사용자 수 → 월 ARPU/ARPPU
  const { data: pays30 } = await admin.from('payments').select('amount, user_id').gte('created_at', since30).limit(10000)
  const revenue30d = (pays30 ?? []).reduce((s, p) => s + (p.amount as number), 0)
  const payingUsers30d = new Set((pays30 ?? []).map(p => p.user_id as string)).size
  const arppu = payingUsers30d > 0 ? Math.round(revenue30d / payingUsers30d) : 0 // 결제자 1인당
  const arpu = totalUsers > 0 ? Math.round(revenue30d / totalUsers) : 0          // 전체 1인당
  // 해지율(%) = 누적 해지 / (활성 + 해지) — 간이 추정
  const churnRate = (subsActive + subsCanceled) > 0
    ? Math.round((subsCanceled / (subsActive + subsCanceled)) * 1000) / 10 : 0

  // 제휴 인기 상품 Top
  const { data: clicks } = await admin.from('affiliate_clicks').select('product_id').limit(10000)
  const byProduct = new Map<string, number>()
  for (const c of clicks ?? []) {
    const id = c.product_id as string
    byProduct.set(id, (byProduct.get(id) ?? 0) + 1)
  }
  const topProducts = Array.from(byProduct.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([product_id, count]) => ({ product_id, count }))

  return NextResponse.json({
    affiliateTotal, affiliate7d,
    subsActive, subsCanceled, subsPastDue,
    paymentsCount, revenue, topProducts,
    // 투자자용 지표
    totalUsers, newUsers7d, newUsers30d,
    premiumUsers, conversionRate,
    revenue30d, payingUsers30d, arppu, arpu, churnRate,
  })
}

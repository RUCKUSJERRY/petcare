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

  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
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
  })
}

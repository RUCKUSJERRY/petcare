import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 연속 기록(streak) 리마인더 푸시 옵트인 설정(본인 profiles 행).
 * - GET  : 현재 사용자의 연속 기록 알림 on/off 조회
 * - POST : { enabled: boolean } 로 설정 (RLS 로 본인 행만 갱신)
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('streak_push_enabled')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enabled: !!data?.streak_push_enabled })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let enabled: boolean
  try {
    enabled = !!(await req.json())?.enabled
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ streak_push_enabled: enabled })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, enabled })
}

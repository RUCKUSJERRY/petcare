import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateToken } from '@/lib/ai/mcp/token'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 개인 MCP 토큰 관리 (로그인 세션 기준, RLS 로 본인 것만).
 * - POST  : 새 토큰 발급. 평문은 응답에 1회만 담아 돌려준다(이후 조회 불가 — 해시만 저장).
 * - GET   : 내 토큰 목록(평문/해시 제외 메타만).
 * - DELETE: ?id= 로 내 토큰 폐기(revoked=true).
 */

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let label: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.label === 'string') label = body.label.slice(0, 80)
  } catch { /* label 선택 */ }

  const { plaintext, hash } = generateToken()
  const { data, error } = await supabase
    .from('mcp_tokens').insert({ user_id: user.id, token_hash: hash, label }).select('id, label, created_at').single()
  if (error) {
    console.error('[mcp/tokens] create failed', error.message)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }
  // 평문 토큰은 지금 한 번만 보여준다.
  return NextResponse.json({ id: data.id, label: data.label, created_at: data.created_at, token: plaintext })
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('mcp_tokens').select('id, label, created_at, last_used_at, revoked').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 })
  return NextResponse.json({ tokens: data ?? [] })
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // RLS 로 본인 토큰만 갱신됨. 폐기는 삭제 대신 revoked 플래그(이력 보존).
  const { error } = await supabase.from('mcp_tokens').update({ revoked: true }).eq('id', id)
  if (error) return NextResponse.json({ error: 'revoke_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

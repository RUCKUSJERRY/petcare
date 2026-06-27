import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 로그인 전 가려던 목적지(같은 출처의 상대경로만 허용 — 오픈 리다이렉트 방지)
  const next = searchParams.get('next')
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  // 구글 등 OAuth 공급자가 사용자 거부/오류 시 error 파라미터로 돌려보낸다.
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // 교환 실패 시 그대로 대시보드로 보내면 미들웨어가 다시 로그인으로 튕겨
    // 사용자가 원인을 알 수 없는 리다이렉트 루프에 빠진다.
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  return NextResponse.redirect(`${origin}${dest}`)
}

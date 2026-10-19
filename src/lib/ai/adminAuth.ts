import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 관리자 라이브 AI 엔드포인트용 접근 제어.
 *
 * 관리자 판별은 보안함수 is_admin() RPC 로 한다(관리자 페이지와 동일 기준, RLS 친화적).
 * 라이브 AI 엔드포인트는 실제 모델을 호출해 비용이 들므로 관리자에게만 연다.
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return false
  return data === true
}

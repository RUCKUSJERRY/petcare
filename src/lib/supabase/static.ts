import { createClient } from '@supabase/supabase-js'

/**
 * 쿠키/세션이 없는 순수 Supabase 클라이언트.
 * 공개 읽기(RLS using(true)) 마스터 데이터 조회 + 캐싱 전용.
 * 사용자 컨텍스트가 없으므로 unstable_cache 안에서 안전하게 쓸 수 있다.
 */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

import { createClient } from '@supabase/supabase-js'

/**
 * 서비스 롤 Supabase 클라이언트 (서버 전용).
 * RLS를 우회하므로 절대 클라이언트로 노출하지 말 것.
 * 푸시 발송 시 수신자의 구독 정보를 읽기 위해 사용.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

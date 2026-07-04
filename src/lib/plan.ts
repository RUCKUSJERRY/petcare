import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * plan / premium_until 로부터 "실제 프리미엄 유효 여부"를 판정하는 순수 함수.
 * 클라이언트 usePlan 과 동일 규칙 — plan='premium' 이고 만료일이 없거나(무기한) 미래면 유효.
 * 서버(결제 무관 기능 게이팅)와 클라이언트가 같은 기준을 쓰도록 여기서 일원화한다.
 */
export function isPremiumActive(
  plan: string | null | undefined,
  premiumUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (plan !== 'premium') return false
  if (!premiumUntil) return true
  return new Date(premiumUntil) > now
}

/**
 * 서버에서 현재 사용자의 프리미엄 유효 여부를 조회한다.
 * profiles 를 읽을 수 없거나(미적용 DB·오류) 값이 없으면 안전하게 false(무료)로 본다.
 */
export async function isUserPremiumServer(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await client
      .from('profiles')
      .select('plan, premium_until')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return false
    return isPremiumActive(data.plan as string | null, data.premium_until as string | null)
  } catch {
    return false
  }
}

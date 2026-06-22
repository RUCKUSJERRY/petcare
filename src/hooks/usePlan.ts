'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface PlanState {
  plan: 'free' | 'premium'
  premiumUntil: string | null
  /** 결제·만료까지 반영한 실제 프리미엄 여부 (광고 제거 등 혜택의 기준) */
  isPremium: boolean
}

const FREE: PlanState = { plan: 'free', premiumUntil: null, isPremium: false }

/**
 * 현재 로그인 사용자의 요금제 상태를 조회한다.
 * - plan='premium' 이고 premium_until 이 null(무기한) 또는 미래면 isPremium=true
 * - 컬럼이 아직 없거나(미적용 DB) 오류면 안전하게 free 로 간주해 앱이 깨지지 않게 한다.
 */
export function usePlan() {
  const supabase = createClient()
  const { data } = useQuery<PlanState>({
    queryKey: ['my-plan'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return FREE
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, premium_until')
        .eq('id', user.id)
        .maybeSingle()
      if (error || !data) return FREE
      const plan = (data.plan as 'free' | 'premium') ?? 'free'
      const premiumUntil = (data.premium_until as string | null) ?? null
      const active = plan === 'premium' && (!premiumUntil || new Date(premiumUntil) > new Date())
      return { plan, premiumUntil, isPremium: active }
    },
    staleTime: 5 * 60 * 1000,
  })
  return data ?? FREE
}

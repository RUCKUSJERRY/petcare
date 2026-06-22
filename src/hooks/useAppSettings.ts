'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { premiumPriceKRW as priceFromEnv } from '@/lib/pricing'
import { adsEnabled as adsEnabledEnv } from '@/lib/ads'

export interface AppSettings {
  premiumPriceKRW: number
  /** 운영설정 + 환경변수 둘 다 켜져 있을 때만 광고 노출 */
  adsEnabled: boolean
}

/**
 * 공개 운영 설정(app_settings)을 읽는다. 가격·광고 토글의 클라이언트 진실원천.
 * 미적용 DB/오류 시 환경변수·기본값으로 폴백한다.
 */
export function useAppSettings(): AppSettings {
  const supabase = createClient()
  const { data } = useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const fallback: AppSettings = { premiumPriceKRW: priceFromEnv(), adsEnabled: adsEnabledEnv() }
      const { data, error } = await supabase.from('app_settings').select('key, value')
      if (error || !data) return fallback
      const map = new Map(data.map(r => [r.key as string, r.value as string]))
      const priceRaw = map.get('premium_price_krw')
      const price = priceRaw ? parseInt(priceRaw.replace(/[^0-9]/g, ''), 10) : NaN
      return {
        premiumPriceKRW: Number.isFinite(price) && price > 0 ? price : priceFromEnv(),
        adsEnabled: map.get('ads_enabled') !== 'false' && adsEnabledEnv(),
      }
    },
    staleTime: 5 * 60 * 1000,
  })
  return data ?? { premiumPriceKRW: priceFromEnv(), adsEnabled: adsEnabledEnv() }
}

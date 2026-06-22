'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { premiumPriceKRW as priceFromEnv } from '@/lib/pricing'
import { adsEnabled as adsEnabledEnv, AD_COOLDOWN_MS } from '@/lib/ads'

// 닫기 후 재노출 기본값(분)
export const DEFAULT_UPSELL_DISMISS_MIN = 1440 // 24시간
export const DEFAULT_BANNER_DISMISS_MIN = 1440 // 24시간

export interface AppSettings {
  premiumPriceKRW: number
  /** 운영설정 + 환경변수 둘 다 켜져 있을 때만 광고 노출 */
  adsEnabled: boolean
  /** 전면 광고 최소 간격(ms). 관리자가 분 단위로 조정. */
  adCooldownMs: number
  /** 프리미엄 업셀 카드 닫은 뒤 재노출까지 간격(ms). */
  upsellDismissMs: number
  /** 가이드 하단 제휴 배너 닫은 뒤 재노출까지 간격(ms). */
  bannerDismissMs: number
}

const FALLBACK = (): AppSettings => ({
  premiumPriceKRW: priceFromEnv(),
  adsEnabled: adsEnabledEnv(),
  adCooldownMs: AD_COOLDOWN_MS,
  upsellDismissMs: DEFAULT_UPSELL_DISMISS_MIN * 60 * 1000,
  bannerDismissMs: DEFAULT_BANNER_DISMISS_MIN * 60 * 1000,
})

/** "분" 설정값(>=0)을 ms로. 없거나 잘못되면 기본 분값으로. */
function minToMs(raw: string | undefined, defaultMin: number): number {
  const n = raw != null ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN
  return (Number.isFinite(n) && n >= 0 ? n : defaultMin) * 60 * 1000
}

/**
 * 공개 운영 설정(app_settings)을 읽는다. 가격·광고·재노출 간격의 클라이언트 진실원천.
 * 미적용 DB/오류 시 환경변수·기본값으로 폴백한다.
 */
export function useAppSettings(): AppSettings {
  const supabase = createClient()
  const { data } = useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value')
      if (error || !data) return FALLBACK()
      const map = new Map(data.map(r => [r.key as string, r.value as string]))
      const priceRaw = map.get('premium_price_krw')
      const price = priceRaw ? parseInt(priceRaw.replace(/[^0-9]/g, ''), 10) : NaN
      const cdRaw = map.get('ad_cooldown_min')
      const cdMin = cdRaw != null ? parseInt(cdRaw.replace(/[^0-9]/g, ''), 10) : NaN
      return {
        premiumPriceKRW: Number.isFinite(price) && price > 0 ? price : priceFromEnv(),
        adsEnabled: map.get('ads_enabled') !== 'false' && adsEnabledEnv(),
        adCooldownMs: Number.isFinite(cdMin) && cdMin >= 0 ? cdMin * 60 * 1000 : AD_COOLDOWN_MS,
        upsellDismissMs: minToMs(map.get('upsell_dismiss_min'), DEFAULT_UPSELL_DISMISS_MIN),
        bannerDismissMs: minToMs(map.get('banner_dismiss_min'), DEFAULT_BANNER_DISMISS_MIN),
      }
    },
    staleTime: 5 * 60 * 1000,
  })
  return data ?? FALLBACK()
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { premiumPriceKRW as priceFromEnv } from '@/lib/pricing'

/**
 * app_settings(운영 설정) 서버 측 읽기.
 * DB 값이 단일 진실원천이며, 없거나 오류면 환경변수/기본값으로 안전하게 폴백한다.
 */
export async function getAppSetting(
  client: SupabaseClient,
  key: string,
): Promise<string | null> {
  try {
    const { data } = await client.from('app_settings').select('value').eq('key', key).maybeSingle()
    return (data?.value as string | undefined) ?? null
  } catch {
    return null
  }
}

/** 서버가 신뢰하는 프리미엄 가격(원). 결제 금액 계산에 사용. */
export async function getPremiumPriceServer(client: SupabaseClient): Promise<number> {
  const raw = await getAppSetting(client, 'premium_price_krw')
  const n = raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : priceFromEnv()
}

/** 무료 사용자의 월 AI(OCR) 인식 무료 제공 횟수. 관리자가 app_settings 로 조정. */
export const DEFAULT_FREE_OCR_MONTHLY = 5
export async function getFreeOcrMonthlyServer(client: SupabaseClient): Promise<number> {
  const raw = await getAppSetting(client, 'free_ocr_monthly')
  const n = raw != null ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_OCR_MONTHLY
}

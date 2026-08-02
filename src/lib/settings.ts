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

/**
 * 생일·입양 기념일 축하 푸시 기능의 전역 on/off (관리자 스위치).
 * 값이 명시적으로 'false' 일 때만 끔 — 미설정/오류면 기본 켬(true)으로 폴백. (ads_enabled 와 동일)
 */
export async function getAnniversaryPushActiveServer(client: SupabaseClient): Promise<boolean> {
  const raw = await getAppSetting(client, 'anniversary_push_active')
  return raw !== 'false'
}

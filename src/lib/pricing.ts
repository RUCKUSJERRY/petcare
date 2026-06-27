/**
 * 프리미엄 가격 (원). 현재는 환경변수에서 읽고, 이후 관리자 페이지(app_settings)로 이관한다.
 *  - NEXT_PUBLIC_PREMIUM_PRICE_KRW : 월 구독 가격(원). 미설정 시 기본 3900원.
 * 서버 결제 금액은 클라이언트 입력을 신뢰하지 않고 이 값을 사용한다.
 */
export const DEFAULT_PREMIUM_PRICE_KRW = 3900

export function premiumPriceKRW(): number {
  const raw = process.env.NEXT_PUBLIC_PREMIUM_PRICE_KRW
  const n = raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PREMIUM_PRICE_KRW
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR')
}

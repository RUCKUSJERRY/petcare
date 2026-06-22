/**
 * 광고(전면/리워드형) 설정.
 *
 * 수익 모델(C/광고): 무료 사용자에게 특정 행동(예: 산책 시작) 직전 전면 광고를 노출한다.
 * 프리미엄 사용자는 광고가 제거된다(Freemium 혜택 ↔ 광고 모델 연계).
 *
 * 현재는 자체/제휴 상품을 광고 소재로 채우고, 실제 광고망(구글 애드센스·카카오 애드핏 등)
 * 슬롯은 환경변수로 교체할 수 있게 비워 둔다.
 *  - NEXT_PUBLIC_ADS_ENABLED='false' 면 광고를 전역 비활성화(개발/심사용)
 *  - NEXT_PUBLIC_AD_NETWORK_SLOT : 실제 광고망 슬롯 ID(연동 시 사용)
 */

/** 광고를 닫고 행동을 진행할 수 있게 되기까지의 카운트다운(초) */
export const AD_COUNTDOWN_SEC = 5

/** 전역 광고 활성화 여부 (기본 on, 'false' 로 끔) */
export function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false'
}

/** 실제 광고망 슬롯이 설정돼 있는지 (없으면 자체 소재로 대체 노출) */
export function adNetworkSlot(): string | null {
  return process.env.NEXT_PUBLIC_AD_NETWORK_SLOT || null
}

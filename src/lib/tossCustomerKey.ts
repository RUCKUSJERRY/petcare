/**
 * 토스 customerKey (사용자별 고정·비공개 식별자) 생성 규칙 — 순수 함수.
 *
 * 서버 헬퍼(lib/toss.ts, TOSS_SECRET_KEY·Buffer 등 서버 전용 코드 포함)와 클라이언트
 * (결제창을 여는 premium 화면)가 '같은 규칙'으로 키를 만들어야 하는데, 서버 모듈을 클라에
 * 끌어오면 시크릿 관련 코드가 번들에 섞인다. 그래서 규칙만 이 순수 모듈로 분리해 양쪽이 함께
 * import 하도록 한다(규칙이 한 곳에만 있어 드리프트가 원천 차단된다).
 *
 * UUID 하이픈을 제거해 토스 customerKey 규격(영문·숫자 등)에 맞춘다.
 */
export function customerKeyForUser(userId: string): string {
  return 'cus_' + userId.replace(/-/g, '')
}

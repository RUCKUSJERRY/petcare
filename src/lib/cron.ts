import { NextResponse } from 'next/server'

/**
 * KST(Asia/Seoul) 기준 'YYYY-MM-DD' 날짜 문자열. offsetDays 로 앞뒤 날짜를 구한다.
 *
 * 기록의 날짜(event_on·next_due_on 등)는 작성자 브라우저의 로컬(KST) 달력 날짜로 저장되는데,
 * 서버 cron 은 UTC 로 동작하므로 시차로 하루 어긋날 수 있다. 여러 push cron 라우트가 이 계산을
 * 각자 복붙해 쓰던 것을 일원화한다. (한국은 DST 가 없어 24h 이동 = 항상 KST 하루 이동)
 */
export function kstDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })
    .format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))
}

/**
 * Vercel Cron 등 내부 스케줄러 전용 엔드포인트의 공통 인증.
 *
 * - CRON_SECRET 이 설정되면 `Authorization: Bearer <secret>` 일치를 요구한다.
 * - 운영(production)에서 CRON_SECRET 미설정 시 **거부(fail-closed)** 한다.
 *   (과거엔 시크릿 미설정 시 누구나 호출 가능 → 결제/푸시 트리거 노출 위험이 있었다.)
 * - 개발 환경에서는 시크릿이 없어도 로컬 테스트가 가능하도록 허용한다.
 *
 * @returns 인증 실패 시 응답(NextResponse), 통과 시 null
 */
export function cronAuthError(req: Request, tag: string): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[${tag}] CRON_SECRET 미설정 — 운영 환경에서 호출 거부`)
      return NextResponse.json({ error: 'cron_secret_required' }, { status: 503 })
    }
    return null // 개발 환경: 시크릿 없이 허용
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

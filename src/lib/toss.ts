/**
 * 토스페이먼츠 빌링(자동결제) 서버 헬퍼.
 * 테스트/라이브는 키만 다르고 호출 방식은 동일하다.
 *  - NEXT_PUBLIC_TOSS_CLIENT_KEY : 클라이언트(결제창)용
 *  - TOSS_SECRET_KEY             : 서버(승인/청구)용 — 절대 클라이언트 노출 금지
 *
 * 흐름: 카드 등록(authKey) → 빌링키 발급 → 빌링키로 매월 청구.
 */

const TOSS_API = 'https://api.tosspayments.com'

export function tossConfigured(): boolean {
  return !!process.env.TOSS_SECRET_KEY
}

/** 토스 customerKey (사용자별 고정·비공개 식별자). UUID 하이픈 제거해 규격에 맞춘다. */
export function customerKeyForUser(userId: string): string {
  return 'cus_' + userId.replace(/-/g, '')
}

function authHeader(): string {
  const sk = process.env.TOSS_SECRET_KEY || ''
  // 시크릿 키 뒤에 ':' 를 붙여 Basic 인증 (비밀번호 없음)
  return 'Basic ' + Buffer.from(sk + ':').toString('base64')
}

export class TossError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'TossError'
    this.status = status
    this.code = code
  }
}

async function tossPost(path: string, body: unknown) {
  let res: Response
  try {
    res = await fetch(`${TOSS_API}${path}`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new TossError('결제 서버에 연결하지 못했어요', 502)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new TossError(data?.message || '결제 처리에 실패했어요', res.status, data?.code)
  }
  return data
}

export interface BillingCard {
  company?: string
  number?: string
}

export interface BillingIssueResult {
  billingKey: string
  card?: BillingCard
}

/** 카드 등록 인증키(authKey)를 빌링키로 교환한다. */
export async function issueBillingKey(authKey: string, customerKey: string): Promise<BillingIssueResult> {
  const data = await tossPost('/v1/billing/authorizations/issue', { authKey, customerKey })
  return { billingKey: data.billingKey, card: data.card }
}

export interface ChargeParams {
  customerKey: string
  amount: number
  orderId: string
  orderName: string
  customerEmail?: string
}

export interface ChargeResult {
  paymentKey: string
  orderId: string
  status: string
  method?: string
  totalAmount: number
}

/** 빌링키로 실제 청구(결제)한다. */
export async function chargeBilling(billingKey: string, p: ChargeParams): Promise<ChargeResult> {
  const data = await tossPost(`/v1/billing/${billingKey}`, {
    customerKey: p.customerKey,
    amount: p.amount,
    orderId: p.orderId,
    orderName: p.orderName,
    ...(p.customerEmail ? { customerEmail: p.customerEmail } : {}),
  })
  return {
    paymentKey: data.paymentKey,
    orderId: data.orderId,
    status: data.status,
    method: data.method,
    totalAmount: data.totalAmount,
  }
}

/** 결제 시작일 기준 1개월 뒤 만료일.
 *  말일 처리: 1/31 → 2/31(없음)이 3/2~3로 넘어가는 setMonth 오버플로를 막기 위해
 *  먼저 1일로 옮겨 달을 더한 뒤, 원래 '일'을 그 달의 말일로 클램프한다.
 *  (예: 1/31 +1개월 → 2/28(윤년 2/29) — 단순 setMonth가 만드는 3/2~3 오차 제거) */
export function addOneMonth(from: Date): Date {
  const d = new Date(from)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

import type { NormalizedUsage } from './usage'

/**
 * LLM 호출 비용 추정.
 *
 * 설계 원칙:
 * - 비용 '계산'(토큰 x 단가)과 '단가 데이터'(모델별 가격, 수시 변동)를 분리한다. 계산은 순수·결정적이라
 *   테스트로 고정하고, 단가는 바뀌어도 테이블만 고치면 된다.
 * - 단가를 모르는 모델은 비용을 0 이 아니라 null 로 둔다. 비용을 날조하면 실제 비용 관리 판단을
 *   오도하므로, '미상'은 '미상'으로 남긴다(옵저버빌리티 대시보드에서 '가격 미설정'으로 구분 가능).
 * - 단가 단위는 USD / 100만 토큰(백만 토큰당 달러) — LLM provider 가격표의 관행 단위.
 *
 * 단가는 추후 app_settings(관리자) 로 옮겨 라이브 갱신할 수 있다(가격 로드맵 2단계). 지금은 코드
 * 기본표 + 미상 null. 아래 값은 '참고용 기본값'이며 실제 청구 단가는 각 provider 콘솔에서 확인/갱신할 것.
 */
export interface ModelPrice {
  /** 입력(프롬프트) 100만 토큰당 USD */
  inputPerMTok: number
  /** 출력(생성) 100만 토큰당 USD */
  outputPerMTok: number
}

/**
 * provider:model 단가표. 키는 `${provider}:${model}` 소문자.
 * 값을 모르는(또는 아직 설정 안 한) 모델은 테이블에 두지 않는다 → priceFor 가 null 반환 → 비용 '미상'.
 *
 * ⚠ 아래 숫자는 참고용 기본값이다. provider 요금 정책은 수시로 바뀌므로, 실제 비용 관리에 쓰기 전
 *   각 콘솔(Upstage/Google 등)에서 현재 단가를 확인하고 갱신하거나 app_settings 로 오버라이드할 것.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Upstage Solar (OpenAI 호환). 참고용 기본값 — 확인 후 갱신.
  'upstage:solar-pro2': { inputPerMTok: 0.25, outputPerMTok: 0.25 },
  'upstage:solar-pro': { inputPerMTok: 0.5, outputPerMTok: 0.5 },
  'upstage:solar-mini': { inputPerMTok: 0.15, outputPerMTok: 0.15 },
}

/** 환경변수 오버라이드 키: AI_PRICE_<PROVIDER>_<MODEL> = "input,output" (USD/Mtok). 예: AI_PRICE_UPSTAGE_SOLAR_PRO2="0.3,0.3" */
function envPrice(provider: string, model: string): ModelPrice | null {
  const key = `AI_PRICE_${provider}_${model}`.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const raw = process.env[key]
  if (!raw) return null
  const [i, o] = raw.split(',').map(s => Number(s.trim()))
  if (!Number.isFinite(i) || !Number.isFinite(o) || i < 0 || o < 0) return null
  return { inputPerMTok: i, outputPerMTok: o }
}

/**
 * provider+model 의 단가를 찾는다. 환경변수 오버라이드 > 코드 기본표 > null(미상).
 * (app_settings 오버라이드는 비동기라 호출부에서 price 를 직접 넘기는 estimateCostUsd 로 합성한다.)
 */
export function priceFor(provider: string, model: string): ModelPrice | null {
  return envPrice(provider, model) ?? MODEL_PRICES[`${provider}:${model}`.toLowerCase()] ?? null
}

/**
 * 토큰 사용량 x 단가 = 비용(USD). 순수·결정적.
 * - price 가 null(단가 미상)이면 null.
 * - 토큰이 한쪽이라도 null(미상)이면 그쪽은 0 으로 보지 않고, 아는 부분까지만 계산하되
 *   input·output 둘 다 미상이면 null. (부분 계상이라도 '미상'을 0 으로 왜곡하지 않도록)
 */
export function estimateCostUsd(
  price: ModelPrice | null,
  usage: Pick<NormalizedUsage, 'inputTokens' | 'outputTokens'>,
): number | null {
  if (!price) return null
  const { inputTokens, outputTokens } = usage
  if (inputTokens == null && outputTokens == null) return null
  const inCost = (inputTokens ?? 0) * price.inputPerMTok
  const outCost = (outputTokens ?? 0) * price.outputPerMTok
  return (inCost + outCost) / 1_000_000
}

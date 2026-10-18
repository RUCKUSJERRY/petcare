/**
 * LLM 토큰 사용량 정규화.
 *
 * AI SDK(ai@7)의 LanguageModelUsage 는 { inputTokens, outputTokens, totalTokens } 이고 각 값이
 * undefined 일 수 있다(provider 가 안 주는 경우). OCR 같은 직접 HTTP 호출은 provider 마다 키가 달라
 * OpenAI 호환은 { prompt_tokens, completion_tokens, total_tokens }, Gemini 는
 * { promptTokenCount, candidatesTokenCount, totalTokenCount } 형태다.
 *
 * 텔레메트리/비용 계산은 provider 와 무관하게 동일한 형태를 전제하므로, 두 형태를 하나로 모은다.
 * - 숫자가 아니면 null 로 둔다(0 과 '미상'을 구분 — 비용 계산이 '미상'을 0 으로 오인하지 않도록).
 * - total 이 없고 input/output 이 있으면 합으로 보완한다.
 */
export interface NormalizedUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

/** 유한한 음이 아닌 정수만 받아들이고, 그 외(undefined·NaN·음수)는 null. */
function toCount(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null
}

/**
 * 다양한 usage 형태(AI SDK camelCase / OpenAI 호환 snake_case)를 NormalizedUsage 로 모은다.
 * 입력이 없으면 모두 null.
 */
export function normalizeUsage(raw: unknown): NormalizedUsage {
  const u = (raw ?? {}) as Record<string, unknown>
  const input = toCount(u.inputTokens ?? u.prompt_tokens ?? u.promptTokens ?? u.promptTokenCount)
  const output = toCount(u.outputTokens ?? u.completion_tokens ?? u.completionTokens ?? u.candidatesTokenCount)
  let total = toCount(u.totalTokens ?? u.total_tokens ?? u.totalTokenCount)
  // total 이 없고 input/output 을 알면 합으로 보완(한쪽만 알면 보완하지 않음 — 과소계상 방지).
  if (total == null && input != null && output != null) total = input + output
  return { inputTokens: input, outputTokens: output, totalTokens: total }
}

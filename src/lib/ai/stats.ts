/**
 * ai_events(LLM 호출 텔레메트리) 집계 — 관리자 비용/품질 패널용.
 *
 * 순수·결정적: 행들을 받아 전체/‑provider별/‑model별/‑feature별 집계를 낸다. DB 조회는 호출부(라우트)가
 * service role 로 하고, 여기서는 계산만 담당(테스트로 고정).
 *
 * 비용(cost_usd)은 단가 미상 행이 null 로 섞여 들어오므로, 아는 값만 합산한다. 아는 행이 하나도
 * 없으면 합계를 0 이 아니라 null('미상')로 둔다 — 비용 데이터의 신뢰도를 왜곡하지 않기 위함.
 */

/** 집계 입력 1행(ai_events 의 집계에 필요한 열만) */
export interface AiEventRow {
  provider: string
  model: string
  feature: string
  success: boolean
  cost_usd: number | null
  total_tokens: number | null
  latency_ms: number | null
}

export interface AiAgg {
  key: string
  calls: number
  successes: number
  /** 성공률 % (소수1자리) */
  successRate: number
  /** 아는 비용의 합(USD). 아는 행이 없으면 null */
  costUsd: number | null
  /** total_tokens 합(미상=0 취급) */
  tokens: number
  /** 평균 지연(ms). 아는 행이 없으면 null */
  avgLatencyMs: number | null
}

export interface AiStats {
  total: AiAgg
  byProvider: AiAgg[]
  byModel: AiAgg[]
  byFeature: AiAgg[]
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** 한 그룹(행들)을 하나의 집계로 접는다. */
function fold(key: string, rows: AiEventRow[]): AiAgg {
  const calls = rows.length
  const successes = rows.reduce((n, r) => n + (r.success ? 1 : 0), 0)

  const priced = rows.filter(r => r.cost_usd != null) as (AiEventRow & { cost_usd: number })[]
  const costUsd = priced.length > 0 ? round6(priced.reduce((s, r) => s + r.cost_usd, 0)) : null

  const tokens = rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0)

  const timed = rows.filter(r => r.latency_ms != null) as (AiEventRow & { latency_ms: number })[]
  const avgLatencyMs = timed.length > 0 ? Math.round(timed.reduce((s, r) => s + r.latency_ms, 0) / timed.length) : null

  return {
    key,
    calls,
    successes,
    successRate: calls > 0 ? round1((successes / calls) * 100) : 0,
    costUsd,
    tokens,
    avgLatencyMs,
  }
}

/** key 추출 함수로 그룹핑 후 각 그룹을 fold. 호출수 내림차순 정렬. */
function groupFold(rows: AiEventRow[], keyOf: (r: AiEventRow) => string): AiAgg[] {
  const groups = new Map<string, AiEventRow[]>()
  for (const r of rows) {
    const k = keyOf(r)
    const arr = groups.get(k)
    if (arr) arr.push(r)
    else groups.set(k, [r])
  }
  return Array.from(groups.entries())
    .map(([k, rs]) => fold(k, rs))
    .sort((a, b) => b.calls - a.calls)
}

/** ai_events 행들의 전체/provider·model·feature별 집계. */
export function aggregateAiEvents(rows: AiEventRow[]): AiStats {
  return {
    total: fold('total', rows),
    byProvider: groupFold(rows, r => r.provider),
    byModel: groupFold(rows, r => `${r.provider}:${r.model}`),
    byFeature: groupFold(rows, r => r.feature),
  }
}

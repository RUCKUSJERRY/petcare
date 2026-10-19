import type { AgentId, AgentRequest, AgentResult, AgentRunner, OrchestrationResult } from './types'
import { getAgent } from './registry'

/**
 * 오케스트레이터(케어 코디네이터) 제어 흐름.
 *
 * route(어느 에이전트) > 각 에이전트 위임(runAgent) > 결과 합치기(synthesize). route/runAgent/synthesize 를
 * 주입받아, 제어 흐름 자체는 순수·결정적으로 테스트한다. 실제 라우팅/실행/합성은 키워드·LLM·RAG 로
 * 바꿔 끼운다. 한 에이전트가 실패해도 나머지로 계속 진행한다(부분 실패 허용).
 */

export interface OrchestrateDeps {
  /** 요청 > 위임할 에이전트 id들 */
  route: (query: string) => AgentId[] | Promise<AgentId[]>
  /** 에이전트 실행 */
  runAgent: AgentRunner
  /** 결과들 > 최종 답변 */
  synthesize: (query: string, results: AgentResult[]) => string | Promise<string>
  /** 동시에 돌릴 최대 에이전트 수(기본 전부) */
  maxConcurrent?: number
}

export async function orchestrate(query: string, deps: OrchestrateDeps): Promise<OrchestrationResult> {
  const routed = await deps.route(query)
  // 유효 에이전트만, 중복 제거, 순서 유지
  const seen = new Set<AgentId>()
  const routedTo = routed.filter(id => getAgent(id) && !seen.has(id) && (seen.add(id), true))

  const req: AgentRequest = { query }
  const results = await Promise.all(
    routedTo.map(async id => {
      const spec = getAgent(id)!
      try {
        return await deps.runAgent(spec, req)
      } catch (e) {
        // 한 에이전트의 실패가 전체를 깨지 않도록 결과로 흡수
        return { agentId: id, answer: '', citations: [], error: e instanceof Error ? e.message : 'agent failed' } as AgentResult
      }
    }),
  )

  const answer = await deps.synthesize(query, results)
  return { query, routedTo, results, answer }
}

/** 결과들을 합치는 기본(비-LLM) 신시사이저 — 에이전트별 답을 소제목으로 나열. 성공한 것만. */
export function concatSynthesize(query: string, results: AgentResult[]): string {
  const ok = results.filter(r => !r.error && r.answer)
  if (ok.length === 0) return '관련 정보를 찾지 못했어요. 질문을 조금 더 구체적으로 알려주실래요?'
  return ok.map(r => r.answer).join('\n\n')
}

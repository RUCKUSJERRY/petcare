import type { AgentId, AgentSpec } from './types'
import { AGENTS } from './registry'

/**
 * 라우팅 — 사용자 요청을 어느 전문 에이전트에 보낼지 정한다.
 *
 * 두 방식을 제공: (1) 키워드 기반(순수·오프라인·결정적) — 신호어 매칭 점수로 상위 에이전트 선택.
 * (2) LLM 기반 — 설명을 보고 모델이 고르게(프롬프트·파싱은 순수, 호출만 밖에서). 코디네이터는
 * 둘 중 아무거나 '라우팅 함수'로 끼운다.
 */

const lower = (s: string) => s.toLowerCase()

/** 키워드 신호 매칭 점수(질의에 등장한 신호어 수). */
export function scoreAgent(query: string, spec: AgentSpec): number {
  const q = lower(query)
  let score = 0
  for (const sig of spec.signals) if (q.includes(lower(sig))) score++
  return score
}

/**
 * 키워드 라우터(순수). 점수>0 인 에이전트를 점수 내림차순으로, 최대 maxAgents 개.
 * 아무 신호도 없으면 기본 에이전트(nutrition — 일반 질문이 가장 많이 걸리는 안전한 기본값) 하나로 폴백.
 */
export function routeByKeywords(query: string, maxAgents = 2, agents: AgentSpec[] = AGENTS): AgentId[] {
  const scored = agents
    .map(a => ({ id: a.id, score: scoreAgent(query, a) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  if (scored.length === 0) return ['nutrition']
  return scored.slice(0, maxAgents).map(s => s.id)
}

/** LLM 라우터 프롬프트(순수). 에이전트 목록을 설명과 함께 제시하고 id 배열(JSON)만 요청. */
export function buildRouterPrompt(query: string, agents: AgentSpec[] = AGENTS): string {
  return [
    `사용자 요청: ${query}`,
    '',
    '아래 전문 에이전트 중, 이 요청을 처리하기에 알맞은 것들의 id 만 JSON 배열로 출력해(1~2개). 예: ["nutrition"]',
    '',
    ...agents.map(a => `- ${a.id}: ${a.description}`),
  ].join('\n')
}

/** LLM 응답에서 에이전트 id 배열 파싱(순수). 유효 id 만, 중복 제거. 없으면 키워드 라우터로 폴백. */
export function parseAgentIds(content: string | undefined | null, query: string, agents: AgentSpec[] = AGENTS): AgentId[] {
  const valid = new Set(agents.map(a => a.id))
  if (content) {
    const m = content.match(/\[[\s\S]*?\]/)
    if (m) {
      try {
        const arr = JSON.parse(m[0])
        if (Array.isArray(arr)) {
          const ids = arr.map(String).filter((x): x is AgentId => valid.has(x as AgentId))
          const uniq = Array.from(new Set(ids))
          if (uniq.length > 0) return uniq
        }
      } catch { /* fall through */ }
    }
  }
  return routeByKeywords(query, 2, agents)
}

import type { AiTask } from '../models/routing'

/**
 * 멀티에이전트 오케스트레이션 공통 타입.
 *
 * '케어 코디네이터'가 사용자 요청을 분석해 역할이 다른 전문 에이전트(증상/기록/영양/일정)에 위임하고
 * 결과를 합친다. 각 에이전트는 자기 시스템프롬프트·모델작업(라우팅)·근거 RAG 소스를 가진다.
 *
 * 에이전트 간 주고받는 메시지는 A2A(agent-to-agent) 스타일의 구조화 엔벨로프(AgentRequest/AgentResult)로
 * 둬서, 나중에 MCP/원격 에이전트로 바꿔도 코디네이터 쪽은 그대로 쓰게 한다.
 */

/** 코디네이터가 위임할 수 있는 전문 에이전트 id */
export type AgentId = 'symptom-triage' | 'records-analyst' | 'nutrition' | 'schedule'

/** 전문 에이전트 정의(순수 데이터) */
export interface AgentSpec {
  id: AgentId
  /** 사람이 읽는 이름 */
  title: string
  /** 라우터·코디네이터가 "언제 이 에이전트인지" 판단할 설명 */
  description: string
  /** 이 에이전트 실행에 쓸 시스템 프롬프트(페르소나·안전수칙) */
  systemPrompt: string
  /** 모델 라우팅 작업 종류(싼/강한 모델 선택) */
  modelTask: AiTask
  /** 근거로 삼을 RAG 코퍼스 소스('symptom'|'food'|'care'|'seasonal'). null 이면 코퍼스 근거 없음(기록 등). */
  ragSource: string | null
  /** 라우팅 신호 키워드(순수 키워드 라우터용) */
  signals: string[]
}

/** A2A 요청 엔벨로프 — 코디네이터 > 에이전트 */
export interface AgentRequest {
  query: string
  /** 선택 컨텍스트(선택된 반려동물·종 등). 에이전트가 참고. */
  context?: Record<string, unknown>
}

/** 근거 인용(앱 정보 화면 링크) */
export interface Citation {
  title: string
  href: string
}

/** A2A 결과 엔벨로프 — 에이전트 > 코디네이터 */
export interface AgentResult {
  agentId: AgentId
  answer: string
  citations: Citation[]
  /** 실패 시 사유(코디네이터는 성공한 결과만 합치고 실패는 표시) */
  error?: string
}

/** 에이전트 실행기(오프라인 모크·LLM 실행 모두 이 형태로 끼운다) */
export type AgentRunner = (spec: AgentSpec, req: AgentRequest) => Promise<AgentResult>

/** 오케스트레이션 최종 결과 */
export interface OrchestrationResult {
  query: string
  routedTo: AgentId[]
  results: AgentResult[]
  answer: string
}

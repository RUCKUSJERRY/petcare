import type { AgentId, AgentSpec } from './types'

/**
 * 전문 에이전트 레지스트리.
 *
 * 각 에이전트는 좁은 역할에 집중하고(단일 책임), 자기 근거(RAG 소스)·안전수칙·모델작업을 가진다.
 * 코디네이터는 이 목록을 보고 요청을 위임한다. 안전수칙은 챗 시스템프롬프트(chat/context.ts)와 같은 결:
 * 수의사 대체 금지, 응급 우선, 불확실 고지.
 */

const SAFETY = '너는 수의사가 아니며 일반 정보만 제공한다. 응급·위험 신호가 보이면 즉시 동물병원 방문을 우선 권하고, 확실하지 않으면 단정하지 말고 수의사 상담을 권한다.'

export const AGENTS: AgentSpec[] = [
  {
    id: 'symptom-triage',
    title: '증상 트리아지',
    description: '구토·설사·기침·절뚝임·중독 의심 등 "지금 증상이 있는데 어떻게 하지"에 대응. 관찰 포인트와 병원 내원 시급도를 안내.',
    systemPrompt: `너는 반려동물 증상 대응 도우미야. 보호자가 말한 증상에 대해 집에서 관찰할 점과 병원 내원 시급도(관찰/곧 내원/응급)를 근거 정보에 기반해 간결히 안내해. ${SAFETY} 약물 용량 등 위험한 구체 수치는 제시하지 않는다.`,
    modelTask: 'chat',
    ragSource: 'symptom',
    signals: ['토', '구토', '설사', '기침', '재채기', '절뚝', '절뚝임', '다리', '중독', '삼킴', '삼켰', '가려움', '피부', '소변', '화장실', '아파', '증상', '응급'],
  },
  {
    id: 'records-analyst',
    title: '기록 분석',
    description: '"이번 주 산책 몇 번 했어", "지난달 병원비 얼마", "마지막 접종 언제"처럼 사용자의 실제 기록·통계에 답. (사용자 데이터 조회 필요)',
    systemPrompt: `너는 반려동물 기록 분석 도우미야. 제공된 사용자 기록·통계(산책·식사·비용·일정 등)만 근거로 사실을 간결히 답해. 데이터에 없는 건 추측하지 말고 모른다고 해.`,
    modelTask: 'chat', // 기록 분석은 전용 모델작업 없이 chat 으로 라우팅
    ragSource: null,
    signals: ['몇 번', '얼마', '언제', '지난달', '이번 주', '통계', '추세', '비용', '병원비', '산책', '기록', '마지막'],
  },
  {
    id: 'nutrition',
    title: '영양·급여',
    description: '사료 고르기·교체·급여량·간식·체형(BCS) 등 먹는 것 전반.',
    systemPrompt: `너는 반려동물 영양·급여 도우미야. 사료·간식·급여량·체형 관리에 대해 근거 정보에 기반해 실천적으로 안내해. ${SAFETY}`,
    modelTask: 'chat',
    ragSource: 'food',
    signals: ['사료', '급여', '간식', '먹이', '밥', '체형', 'bcs', '칼로리', '영양', '교체', '습식', '수분'],
  },
  {
    id: 'schedule',
    title: '일정·케어',
    description: '양치·목욕·미용·발톱·접종/구충 등 주기적 돌봄 일정과 계절 케어 포인트.',
    systemPrompt: `너는 반려동물 돌봄 일정 도우미야. 양치·목욕·미용·발톱·접종/구충 주기와 계절 케어 포인트를 근거 정보에 기반해 안내해. ${SAFETY}`,
    modelTask: 'chat',
    ragSource: 'care',
    signals: ['양치', '목욕', '미용', '발톱', '귀', '빗질', '접종', '구충', '예방', '주기', '자주', '계절', '여름', '겨울', '봄', '가을', '일정'],
  },
]

const BY_ID = new Map<AgentId, AgentSpec>(AGENTS.map(a => [a.id, a]))

export function getAgent(id: AgentId): AgentSpec | undefined {
  return BY_ID.get(id)
}

export function listAgents(): AgentSpec[] {
  return AGENTS
}

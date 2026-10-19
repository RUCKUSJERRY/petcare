import { describe, expect, it } from 'vitest'
import { routeByKeywords, scoreAgent, buildRouterPrompt, parseAgentIds } from './router'
import { orchestrate, concatSynthesize, type OrchestrateDeps } from './orchestrator'
import { getAgent, listAgents } from './registry'
import { makeGroundedMockRunner } from './runner'
import { buildRagIndex } from '../rag/retriever'
import type { AgentResult } from './types'

describe('registry', () => {
  it('4개 에이전트, id 고유, 필수 필드', () => {
    const agents = listAgents()
    expect(agents).toHaveLength(4)
    expect(new Set(agents.map(a => a.id)).size).toBe(4)
    for (const a of agents) {
      expect(a.systemPrompt.length).toBeGreaterThan(0)
      expect(a.signals.length).toBeGreaterThan(0)
    }
  })
})

describe('routeByKeywords', () => {
  it('증상 질의 > 트리아지', () => {
    expect(routeByKeywords('우리 개가 자꾸 토해요', 1)).toEqual(['symptom-triage'])
  })
  it('사료 질의 > 영양', () => {
    expect(routeByKeywords('사료 고를 때 뭘 봐요', 1)).toEqual(['nutrition'])
  })
  it('양치 질의 > 일정·케어', () => {
    expect(routeByKeywords('양치 얼마나 자주', 1)).toEqual(['schedule'])
  })
  it('기록 질의 > 기록 분석', () => {
    expect(routeByKeywords('이번 주 산책 몇 번 했어', 1)).toEqual(['records-analyst'])
  })
  it('신호 없으면 nutrition 폴백', () => {
    expect(routeByKeywords('안녕', 2)).toEqual(['nutrition'])
  })
  it('여러 신호면 점수순 상위 N', () => {
    const ids = routeByKeywords('사료 바꾸고 나서 토하고 설사해요', 2)
    expect(ids).toContain('symptom-triage') // 토·설사 2신호
    expect(ids.length).toBeLessThanOrEqual(2)
  })
  it('scoreAgent 는 신호어 수', () => {
    const triage = getAgent('symptom-triage')!
    expect(scoreAgent('토하고 설사', triage)).toBeGreaterThanOrEqual(2)
  })
})

describe('LLM 라우터 파싱', () => {
  it('유효 id 배열 파싱', () => {
    expect(parseAgentIds('["nutrition","schedule"]', 'q')).toEqual(['nutrition', 'schedule'])
  })
  it('설명 섞여도 첫 배열 추출, 무효 id 제거', () => {
    expect(parseAgentIds('골라봤어: ["nutrition","bogus"]', 'q')).toEqual(['nutrition'])
  })
  it('파싱 실패/빈 결과면 키워드 폴백', () => {
    expect(parseAgentIds('모르겠음', '사료 교체')).toEqual(['nutrition'])
  })
  it('프롬프트에 에이전트 설명 포함', () => {
    expect(buildRouterPrompt('q')).toContain('symptom-triage')
  })
})

describe('orchestrate (제어 흐름, 모크)', () => {
  const baseDeps = (over: Partial<OrchestrateDeps> = {}): OrchestrateDeps => ({
    route: () => ['nutrition', 'schedule'],
    runAgent: async spec => ({ agentId: spec.id, answer: `${spec.id} 답`, citations: [] }),
    synthesize: concatSynthesize,
    ...over,
  })

  it('라우팅 > 위임 > 합성', async () => {
    const r = await orchestrate('사료랑 양치', baseDeps())
    expect(r.routedTo).toEqual(['nutrition', 'schedule'])
    expect(r.results).toHaveLength(2)
    expect(r.answer).toContain('nutrition 답')
    expect(r.answer).toContain('schedule 답')
  })

  it('무효/중복 라우팅 id 는 걸러진다', async () => {
    const r = await orchestrate('q', baseDeps({ route: () => ['nutrition', 'nutrition', 'bogus' as never] }))
    expect(r.routedTo).toEqual(['nutrition'])
  })

  it('한 에이전트가 throw 해도 나머지로 진행(부분 실패)', async () => {
    const r = await orchestrate('q', baseDeps({
      route: () => ['nutrition', 'schedule'],
      runAgent: async spec => {
        if (spec.id === 'nutrition') throw new Error('boom')
        return { agentId: spec.id, answer: 'ok', citations: [] }
      },
    }))
    const nut = r.results.find(x => x.agentId === 'nutrition')!
    expect(nut.error).toBe('boom')
    expect(r.answer).toContain('ok') // schedule 성공분은 합성됨
  })

  it('모두 실패면 안내 문구', async () => {
    const fail: AgentResult[] = []
    const r = await orchestrate('q', baseDeps({
      route: () => ['nutrition'],
      runAgent: async () => { throw new Error('x') },
      synthesize: (q, res) => { fail.push(...res); return concatSynthesize(q, res) },
    }))
    expect(r.answer).toContain('찾지 못했')
  })
})

describe('makeGroundedMockRunner (실 코퍼스, 오프라인 end-to-end)', () => {
  it('증상 질의가 트리아지로 라우팅돼 symptom 근거를 단다', async () => {
    const index = buildRagIndex({ maxChars: 300 })
    const deps: OrchestrateDeps = {
      route: q => routeByKeywords(q, 1),
      runAgent: makeGroundedMockRunner(index),
      synthesize: concatSynthesize,
    }
    const r = await orchestrate('우리 고양이가 소변을 못 봐요', deps)
    expect(r.routedTo).toEqual(['symptom-triage'])
    const res = r.results[0]
    expect(res.citations.length).toBeGreaterThan(0)
    expect(res.citations.every(c => c.href === '/symptoms')).toBe(true)
  })

  it('기록 질의는 근거 코퍼스 없이 "툴 연결 필요" 안내', async () => {
    const index = buildRagIndex({ maxChars: 300 })
    const runner = makeGroundedMockRunner(index)
    const res = await runner(getAgent('records-analyst')!, { query: '지난달 병원비 얼마' })
    expect(res.citations).toEqual([])
    expect(res.answer).toContain('기록')
  })
})

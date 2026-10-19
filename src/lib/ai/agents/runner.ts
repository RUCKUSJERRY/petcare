import { generateText } from 'ai'
import type { RagIndex } from '../rag/retriever'
import type { AgentRunner, AgentResult, AgentSpec, Citation } from './types'
import { buildModel, specsFromEnv } from '../models/registry'
import { selectModel } from '../models/routing'

/**
 * 에이전트 실행기 — 각 에이전트를 RAG 로 근거를 붙여 돌린다.
 *
 * - makeGroundedMockRunner: 오프라인·결정적. lexical 검색으로 근거만 뽑아 요약(LLM 없이). 데모·테스트용.
 * - makeLlmAgentRunner: 실제 모델 실행(게이팅). RAG 로 근거를 모아 systemPrompt 와 함께 생성.
 * 둘 다 같은 AgentRunner 형태라 오케스트레이터는 바꿔 끼우기만 한다.
 */

/** 근거 청크(제목+스니펫)를 프롬프트에 넣을 문자열로. */
function groundingBlock(chunks: { title: string; text: string }[]): string {
  return chunks.map((c, i) => `[근거${i + 1}] ${c.title}: ${c.text.replace(/\n/g, ' ').slice(0, 220)}`).join('\n')
}

/** href 기준 중복 제거 인용. */
function toCitations(chunks: { title: string; href: string }[]): Citation[] {
  const seen = new Set<string>()
  const out: Citation[] = []
  for (const c of chunks) {
    const key = `${c.title}|${c.href}`
    if (!seen.has(key)) { seen.add(key); out.push({ title: c.title, href: c.href }) }
  }
  return out
}

/** 에이전트의 근거 소스에서 상위 청크를 뽑는다(lexical, 소스 필터). */
function groundFor(index: RagIndex, spec: AgentSpec, query: string, topK: number) {
  if (!spec.ragSource) return []
  return index.searchLexical(query, topK * 3).filter(h => h.item.source === spec.ragSource).slice(0, topK).map(h => h.item)
}

/**
 * 오프라인 결정적 러너. LLM 없이 근거만 요약해 답을 만든다(라우팅·위임·그라운딩 구조를 키 없이 시연).
 * records-analyst 는 근거 코퍼스가 없어, 실제 구현에선 기록/통계 툴을 붙여야 함을 안내한다.
 */
export function makeGroundedMockRunner(index: RagIndex, topK = 3): AgentRunner {
  return async (spec, req) => {
    if (!spec.ragSource) {
      return { agentId: spec.id, answer: `${spec.title}: 사용자 기록을 조회해야 하는 질문이에요(실제 구현은 기록·통계 툴 연결).`, citations: [] }
    }
    const hits = groundFor(index, spec, req.query, topK)
    if (hits.length === 0) return { agentId: spec.id, answer: `${spec.title}: 관련 정보를 찾지 못했어요.`, citations: [] }
    const citations = toCitations(hits) // 같은 문서의 여러 청크는 한 번만(제목 중복 제거)
    return {
      agentId: spec.id,
      answer: `${spec.title}: ${citations.map(c => c.title).join(' · ')} 를 참고하세요.`,
      citations,
    }
  }
}

/**
 * LLM 러너(게이팅). spec.modelTask 로 모델을 라우팅하고, RAG 근거 + systemPrompt 로 답을 생성한다.
 * 모델 미구성이면 error 결과를 돌려준다(오케스트레이터가 부분 실패로 흡수).
 */
export function makeLlmAgentRunner(index: RagIndex, topK = 4): AgentRunner {
  return async (spec, req) => {
    const model = selectModel(spec.modelTask, specsFromEnv())
    if (!model) return { agentId: spec.id, answer: '', citations: [], error: 'no model configured' }
    const hits = groundFor(index, spec, req.query, topK)
    const grounding = hits.length ? `\n\n참고 정보:\n${groundingBlock(hits)}` : ''
    try {
      const { text } = await generateText({
        model: buildModel(model),
        system: spec.systemPrompt,
        prompt: `${req.query}${grounding}`,
        temperature: 0.3,
      })
      return { agentId: spec.id, answer: text.trim(), citations: toCitations(hits) }
    } catch (e) {
      return { agentId: spec.id, answer: '', citations: [], error: e instanceof Error ? e.message : 'generate failed' }
    }
  }
}

/** 결과 합성용 프롬프트(순수) — 코디네이터가 에이전트 답들을 하나로 정리할 때. */
export function buildSynthesisPrompt(query: string, results: AgentResult[]): string {
  const blocks = results.filter(r => !r.error && r.answer).map(r => `## ${r.agentId}\n${r.answer}`)
  return [
    `사용자 질문: ${query}`,
    '',
    '아래 전문 에이전트들의 답을 모아, 중복을 줄이고 보호자가 읽기 쉽게 한국어로 간결히 정리해. 응급·안전 주의는 빠뜨리지 마.',
    '',
    ...blocks,
  ].join('\n')
}

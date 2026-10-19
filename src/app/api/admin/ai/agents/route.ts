import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/ai/adminAuth'
import { buildRagIndex } from '@/lib/ai/rag/retriever'
import { orchestrate, concatSynthesize } from '@/lib/ai/agents/orchestrator'
import { routeByKeywords } from '@/lib/ai/agents/router'
import { makeGroundedMockRunner, makeLlmAgentRunner } from '@/lib/ai/agents/runner'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 운영 멀티에이전트 오케스트레이션 라이브 점검(관리자 전용). POST { query, live?: boolean }.
 * - live=false(기본): 오프라인 그라운딩 러너(키 없이 라우팅+RAG 근거 end-to-end).
 * - live=true: 실제 모델로 각 에이전트 실행(makeLlmAgentRunner). 모델 키 필요.
 * - CLI(agents:demo)로만 보던 오케스트레이션을 운영 배포에서 HTTP 로 확인하기 위함.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  if (!(await requireAdmin(supabase))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let query = ''
  let live = false
  try {
    const body = await req.json()
    query = typeof body?.query === 'string' ? body.query.trim() : ''
    live = body?.live === true
  } catch { /* 기본값 */ }
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const index = buildRagIndex({ maxChars: 300 })
  const runAgent = live ? makeLlmAgentRunner(index) : makeGroundedMockRunner(index)
  const t0 = Date.now()
  const result = await orchestrate(query, {
    route: q => routeByKeywords(q, 2),
    runAgent,
    synthesize: concatSynthesize,
  })
  return NextResponse.json({
    query,
    mode: live ? 'live' : 'offline',
    latencyMs: Date.now() - t0,
    routedTo: result.routedTo,
    results: result.results.map(r => ({ agentId: r.agentId, answer: r.answer, citations: r.citations, error: r.error })),
    answer: result.answer,
  })
}

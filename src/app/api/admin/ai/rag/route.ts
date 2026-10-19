import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/ai/adminAuth'
import { buildRagIndex } from '@/lib/ai/rag/retriever'
import { embeddingAvailable, embedIndex, hybridDocRetriever } from '@/lib/ai/rag/embed'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 운영 RAG 라이브 점검(관리자 전용). POST { query, mode?: 'lexical'|'hybrid' }.
 * - lexical(기본): 키 없이 즉시. hybrid: 임베딩 provider 가 구성돼야 함(실제 벡터+RRF).
 * - CLI(rag:eval)로만 보던 검색을 운영 배포에서 HTTP 로 확인하기 위함.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  if (!(await requireAdmin(supabase))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let query = ''
  let mode = 'lexical'
  try {
    const body = await req.json()
    query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (body?.mode === 'hybrid') mode = 'hybrid'
  } catch { /* 기본값 */ }
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const index = buildRagIndex({ maxChars: 300 })
  const t0 = Date.now()

  if (mode === 'hybrid') {
    if (!embeddingAvailable()) {
      return NextResponse.json({ error: 'embedding_not_configured', message: '임베딩 provider 키가 필요해요.' }, { status: 503 })
    }
    try {
      const embedder = await embedIndex(index)
      const docIds = await hybridDocRetriever(index, embedder)(query)
      return NextResponse.json({ mode, query, latencyMs: Date.now() - t0, docIds: docIds.slice(0, 5) })
    } catch (e) {
      return NextResponse.json({ error: 'hybrid_failed', message: e instanceof Error ? e.message.slice(0, 160) : 'error' }, { status: 502 })
    }
  }

  const hits = index.searchLexical(query, 5).map(h => ({ id: h.item.docId, title: h.item.title, href: h.item.href, score: Math.round(h.score * 100) / 100 }))
  return NextResponse.json({ mode, query, latencyMs: Date.now() - t0, hits })
}

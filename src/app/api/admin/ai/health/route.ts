import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/ai/adminAuth'
import { specsFromEnv } from '@/lib/ai/models/registry'
import { embeddingSpecFromEnv } from '@/lib/ai/rag/embed'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 운영 AI 구성 헬스체크(관리자 전용).
 * - 구성된 챗/추출 provider·임베딩 provider 를 보고(키 노출 없이 provider/model 이름만).
 * - ?ping=1 이면 라이브 모델로 아주 짧은 호출을 1회 해 실제 연결/지연을 확인(소액 비용 발생).
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  if (!(await requireAdmin(supabase))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const chatModels = specsFromEnv().map(s => s.id)
  const embedding = embeddingSpecFromEnv()
  const result: Record<string, unknown> = {
    chatModels,
    embedding: embedding ? `${embedding.provider}:${embedding.model}` : null,
    reranker: chatModels.length > 0,
  }

  if (new URL(req.url).searchParams.get('ping') === '1') {
    const specs = specsFromEnv()
    if (specs.length === 0) {
      result.ping = { ok: false, reason: 'no chat model configured' }
    } else {
      // 동적 import — 라이브 핑일 때만 AI SDK 를 들인다.
      const { generateText } = await import('ai')
      const { buildModel } = await import('@/lib/ai/models/registry')
      const t0 = Date.now()
      try {
        const { text } = await generateText({ model: buildModel(specs[0]), prompt: 'ping. reply with: pong', temperature: 0 })
        result.ping = { ok: true, model: specs[0].id, latencyMs: Date.now() - t0, sample: text.slice(0, 40) }
      } catch (e) {
        result.ping = { ok: false, model: specs[0].id, error: e instanceof Error ? e.message.slice(0, 120) : 'error' }
      }
    }
  }

  return NextResponse.json(result)
}

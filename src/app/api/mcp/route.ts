import { handleMcpRequest, type JsonRpcRequest } from '@/lib/ai/mcp/server'
import { parseBearer, hashToken } from '@/lib/ai/mcp/token'
import { type McpUserContext } from '@/lib/ai/mcp/userData'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * MCP(Model Context Protocol) 엔드포인트 — petcare 기능을 외부 MCP 클라이언트에 노출.
 *
 * JSON-RPC 2.0(단일/배치)을 순수 디스패처(handleMcpRequest)로 처리. 이 라우트는 전송 + 인증만 담당.
 * - 인증 없음: 공개 지식 툴만(읽기전용 큐레이션 콘텐츠, PII 없음).
 * - Authorization: Bearer <token>: 토큰을 sha256 해시로 조회해 주인(user_id)을 식별하면, 그 사용자의
 *   데이터 툴이 추가로 노출됨. 토큰 검증은 세션이 없으므로 service role 로 하되, 데이터 조회는
 *   userData 가 pet_members 기준으로 엄격히 그 주인 범위로만 제한함.
 */

/** Bearer 토큰 > 인증 컨텍스트. 토큰이 없거나 무효면 null(공개 툴만). */
async function authContext(req: Request): Promise<McpUserContext | null> {
  const token = parseBearer(req.headers.get('authorization'))
  if (!token) return null
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return null // service role 미설정 > 인증 불가, 공개 툴만
  }
  const { data } = await admin
    .from('mcp_tokens').select('user_id, revoked').eq('token_hash', hashToken(token)).maybeSingle()
  const row = data as { user_id: string; revoked: boolean } | null
  if (!row || row.revoked) return null
  // 마지막 사용 시각 갱신(best-effort)
  admin.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('token_hash', hashToken(token))
    .then(({ error }) => { if (error) console.error('[mcp] last_used update failed', error.message) })
  return { userId: row.user_id, admin }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, { status: 400 })
  }

  const ctx = await authContext(req)

  // 배치 요청(JSON-RPC 배열) 지원
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(r => handleMcpRequest(r as JsonRpcRequest, ctx)))).filter(Boolean)
    return responses.length === 0 ? new NextResponse(null, { status: 204 }) : NextResponse.json(responses)
  }

  const res = await handleMcpRequest(body as JsonRpcRequest, ctx)
  if (res === null) return new NextResponse(null, { status: 204 }) // 알림 — 본문 없음
  return NextResponse.json(res)
}

/** 헬스체크/탐색용 — 서버 정보와 사용법 힌트. */
export async function GET() {
  return NextResponse.json({
    server: 'petcare-knowledge (MCP)',
    transport: 'JSON-RPC 2.0 over HTTP POST',
    hint: 'POST {"jsonrpc":"2.0","id":1,"method":"tools/list"} 로 툴 목록 조회. 개인 데이터 툴은 Authorization: Bearer <토큰> 필요.',
  })
}

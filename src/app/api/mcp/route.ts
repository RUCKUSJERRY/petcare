import { handleMcpRequest, type JsonRpcRequest } from '@/lib/ai/mcp/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * MCP(Model Context Protocol) 엔드포인트 — petcare 의 공개 반려동물 지식을 외부 MCP 클라이언트에 노출.
 *
 * JSON-RPC 2.0(단일 요청/배치)을 받아 순수 디스패처(handleMcpRequest)로 처리한다. 이 라우트는 전송만
 * 담당(파싱·직렬화). 읽기전용 큐레이션 지식만 다루므로 인증은 두지 않는다(사용자 데이터는 노출 안 함).
 *
 * 연결: MCP 클라이언트의 Streamable HTTP 서버 URL 로 이 경로를 지정. (notification 은 204 로 응답)
 */
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, { status: 400 })
  }

  // 배치 요청(JSON-RPC 배열) 지원
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(r => handleMcpRequest(r as JsonRpcRequest)))).filter(Boolean)
    return responses.length === 0 ? new NextResponse(null, { status: 204 }) : NextResponse.json(responses)
  }

  const res = await handleMcpRequest(body as JsonRpcRequest)
  if (res === null) return new NextResponse(null, { status: 204 }) // 알림 — 본문 없음
  return NextResponse.json(res)
}

/** 헬스체크/탐색용 — 서버 정보와 사용법 힌트. */
export async function GET() {
  return NextResponse.json({
    server: 'petcare-knowledge (MCP)',
    transport: 'JSON-RPC 2.0 over HTTP POST',
    hint: 'POST {"jsonrpc":"2.0","id":1,"method":"tools/list"} 로 사용 가능한 툴을 조회하세요.',
  })
}

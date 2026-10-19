import { MCP_TOOLS, getMcpTool } from './tools'

/**
 * MCP(Model Context Protocol) JSON-RPC 디스패처 (순수, 전송 무관).
 *
 * MCP 는 JSON-RPC 2.0 위에서 initialize / tools/list / tools/call 등을 주고받는다. 여기서는 전송
 * (stdio·HTTP)과 분리된 '요청 객체 > 응답 객체' 핸들러만 둬서 결정적으로 테스트한다. Next 라우트·CLI 는
 * 이 핸들러를 얇게 감싸 전송만 담당한다.
 */

export const SERVER_INFO = { name: 'petcare-knowledge', version: '1.0.0' }
export const DEFAULT_PROTOCOL = '2024-11-05'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

const ERR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 }

function ok(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}
function fail(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

/** tools/list 결과(스키마 포함). 핸들러는 노출하지 않는다. */
function toolList() {
  return { tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }
}

/**
 * 한 JSON-RPC 요청을 처리한다. 알림(notification: id 없음)에는 null 을 돌려줘 호출부가 응답을 생략하게 한다.
 */
export async function handleMcpRequest(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  if (!req || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return fail(req?.id ?? null, ERR.invalidRequest, 'invalid JSON-RPC request')
  }
  const isNotification = req.id === undefined || req.id === null

  switch (req.method) {
    case 'initialize': {
      const clientProto = typeof req.params?.protocolVersion === 'string' ? req.params.protocolVersion : null
      return ok(req.id, {
        protocolVersion: clientProto || DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })
    }
    case 'notifications/initialized':
    case 'initialized':
      return null // 알림 — 응답 없음
    case 'ping':
      return ok(req.id, {})
    case 'tools/list':
      return ok(req.id, toolList())
    case 'tools/call': {
      const name = typeof req.params?.name === 'string' ? req.params.name : ''
      const tool = getMcpTool(name)
      if (!tool) return fail(req.id, ERR.invalidParams, `unknown tool: ${name || '(none)'}`)
      const args = (req.params?.arguments as Record<string, unknown>) ?? {}
      try {
        const text = await tool.handler(args)
        return ok(req.id, { content: [{ type: 'text', text }], isError: false })
      } catch (e) {
        // MCP 관례: 툴 실행 오류는 프로토콜 에러가 아니라 isError 결과로 돌려준다.
        return ok(req.id, { content: [{ type: 'text', text: e instanceof Error ? e.message : 'tool error' }], isError: true })
      }
    }
    default:
      if (isNotification) return null // 모르는 알림은 무시
      return fail(req.id, ERR.methodNotFound, `method not found: ${req.method}`)
  }
}

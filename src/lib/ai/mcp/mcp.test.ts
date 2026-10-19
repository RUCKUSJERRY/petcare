import { describe, expect, it } from 'vitest'
import { handleMcpRequest, SERVER_INFO } from './server'
import { MCP_TOOLS, getMcpTool } from './tools'

describe('MCP tools', () => {
  it('세 툴을 노출하고 각 필수 필드/스키마를 갖는다', () => {
    const names = MCP_TOOLS.map(t => t.name).sort()
    expect(names).toEqual(['list_knowledge_topics', 'search_pet_care_knowledge', 'triage_pet_symptom'])
    for (const t of MCP_TOOLS) {
      expect(t.description.length).toBeGreaterThan(0)
      expect((t.inputSchema as { type: string }).type).toBe('object')
    }
  })

  it('search 핸들러: 양치 질의에 양치 지식(care)을 돌려준다', async () => {
    const text = await getMcpTool('search_pet_care_knowledge')!.handler({ query: '강아지 양치 치석' })
    expect(text).toContain('양치')
    expect(text).toContain('/care')
  })

  it('search: source 로 영역 한정', async () => {
    const text = await getMcpTool('search_pet_care_knowledge')!.handler({ query: '여름 더위', source: 'seasonal' })
    expect(text).toContain('[seasonal]')
  })

  it('search: query 없으면 throw', async () => {
    await expect(getMcpTool('search_pet_care_knowledge')!.handler({})).rejects.toThrow()
  })

  it('triage: 증상 설명에 출처 + 안전 주의 문구', async () => {
    const text = await getMcpTool('triage_pet_symptom')!.handler({ symptom: '고양이가 소변을 못 봐요' })
    expect(text).toContain('/symptoms')
    expect(text).toContain('동물병원')
  })
})

describe('handleMcpRequest (JSON-RPC)', () => {
  it('initialize: serverInfo·capabilities·protocolVersion', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
    expect(res!.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
    })
  })

  it('initialize: 클라이언트 protocolVersion 없으면 기본값', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' })
    expect((res!.result as { protocolVersion: string }).protocolVersion).toBe('2024-11-05')
  })

  it('notifications/initialized 는 응답 없음(null)', async () => {
    expect(await handleMcpRequest({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
  })

  it('tools/list: 스키마 포함 툴 목록, handler 는 노출 안 함', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const tools = (res!.result as { tools: Record<string, unknown>[] }).tools
    expect(tools).toHaveLength(3)
    expect(tools[0]).toHaveProperty('inputSchema')
    expect(tools[0]).not.toHaveProperty('handler')
  })

  it('tools/call: 결과를 content 배열로', async () => {
    const res = await handleMcpRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'list_knowledge_topics', arguments: { source: 'food' } },
    })
    const r = res!.result as { content: { type: string; text: string }[]; isError: boolean }
    expect(r.isError).toBe(false)
    expect(r.content[0].type).toBe('text')
    expect(r.content[0].text).toContain('[food]')
  })

  it('tools/call: 모르는 툴 > invalidParams 에러', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope' } })
    expect(res!.error!.code).toBe(-32602)
  })

  it('tools/call: 핸들러 throw 는 프로토콜 에러가 아니라 isError 결과', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'search_pet_care_knowledge', arguments: {} } })
    const r = res!.result as { isError: boolean }
    expect(r.isError).toBe(true)
    expect(res!.error).toBeUndefined()
  })

  it('모르는 method > methodNotFound', async () => {
    const res = await handleMcpRequest({ jsonrpc: '2.0', id: 6, method: 'does/notexist' })
    expect(res!.error!.code).toBe(-32601)
  })

  it('잘못된 요청(jsonrpc 아님) > invalidRequest', async () => {
    const res = await handleMcpRequest({ method: 'x' } as never)
    expect(res!.error!.code).toBe(-32600)
  })
})

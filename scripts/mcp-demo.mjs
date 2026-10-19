// MCP 서버 데모 (CLI). MCP 클라이언트처럼 initialize > tools/list > tools/call 을 순서대로 호출해
// JSON-RPC 교환을 보여준다(오프라인·결정적, 전송 없이 디스패처 직접 호출).
//
// 실행: npm run mcp:demo
//
// TS 는 Vite ssrLoadModule 로 로드(기존 의존성만).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

async function main() {
  const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, plugins: [tsconfigPaths()] })
  try {
    const { handleMcpRequest } = await server.ssrLoadModule('/src/lib/ai/mcp/server.ts')
    const call = async (label, req) => {
      const res = await handleMcpRequest(req)
      console.log(`\n  > ${label}`)
      console.log('    req :', JSON.stringify(req))
      console.log('    res :', res === null ? '(no response — notification)' : JSON.stringify(res).slice(0, 400))
      return res
    }

    console.log('\n  petcare MCP 서버 데모 (JSON-RPC 2.0)')

    await call('initialize', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
    await call('notifications/initialized', { jsonrpc: '2.0', method: 'notifications/initialized' })

    const list = await call('tools/list', { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const names = (list.result?.tools ?? []).map(t => t.name)
    console.log('\n  노출 툴:', names.join(', '))

    await call('tools/call search_pet_care_knowledge', {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'search_pet_care_knowledge', arguments: { query: '여름 산책 주의', source: 'seasonal', topK: 2 } },
    })
    await call('tools/call triage_pet_symptom', {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'triage_pet_symptom', arguments: { symptom: '자꾸 토하고 기운이 없어요' } },
    })

    console.log('\n  (HTTP 로 쓰려면: POST /api/mcp — 같은 JSON-RPC 본문)\n')
  } finally {
    await server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

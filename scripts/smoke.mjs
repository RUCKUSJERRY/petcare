// 운영/배포 스모크 점검 — 실제로 떠 있는 앱의 HTTP 엔드포인트를 때려 AI 기능이 온라인에서 도는지 본다.
// (오프라인 테스트/데모와 달리, 이건 '운영환경 기준' 확인이다.)
//
// 사용:
//   BASE_URL=https://내앱.vercel.app npm run smoke
//   BASE_URL=http://localhost:3000 npm run smoke         # 로컬 dev 서버
//   MCP_TOKEN=pck_... BASE_URL=... npm run smoke          # 개인 데이터 툴까지 점검
//
// 모델 키가 서버에 설정돼 있으면 챗/RAG hybrid 등도 실제로 동작한다. 이 스크립트는 공개 MCP 경로만
// 점검한다(관리자/챗 엔드포인트는 인증이 필요해 수동 확인 — README '운영환경 테스트' 참고).

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const TOKEN = process.env.MCP_TOKEN || ''

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? ` - ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`) }
}

async function rpc(method, params, token) {
  try {
    const res = await fetch(`${BASE}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch (e) {
    return { status: 0, body: null, error: String(e?.message ?? e) }
  }
}

async function main() {
  console.log(`\n  스모크 점검 > ${BASE}\n`)

  // 1) MCP 헬스(GET)
  try {
    const r = await fetch(`${BASE}/api/mcp`)
    const b = await r.json().catch(() => null)
    ok('GET /api/mcp (health)', r.ok && typeof b?.server === 'string', b?.server)
  } catch (e) { ok('GET /api/mcp (health)', false, String(e?.message ?? e)) }

  // 2) tools/list (공개)
  const list = await rpc('tools/list', {})
  const names = (list.body?.result?.tools ?? []).map(t => t.name)
  ok('tools/list (public)', list.status === 200 && names.includes('search_pet_care_knowledge'), names.join(','))

  // 3) tools/call 검색
  const call = await rpc('tools/call', { name: 'search_pet_care_knowledge', arguments: { query: '양치', topK: 2 } })
  const text = call.body?.result?.content?.[0]?.text ?? ''
  ok('tools/call search_pet_care_knowledge', call.status === 200 && text.length > 0, text.slice(0, 40).replace(/\n/g, ' '))

  // 4) 토큰이 있으면 개인 데이터 툴 노출 + 호출
  if (TOKEN) {
    const authed = await rpc('tools/list', {}, TOKEN)
    const anames = (authed.body?.result?.tools ?? []).map(t => t.name)
    ok('tools/list (authed) > 개인 툴 노출', anames.includes('get_my_pets'), anames.join(','))
    const pets = await rpc('tools/call', { name: 'get_my_pets', arguments: {} }, TOKEN)
    const ptext = pets.body?.result?.content?.[0]?.text ?? ''
    ok('tools/call get_my_pets', pets.status === 200 && ptext.length > 0, ptext.slice(0, 60))
  } else {
    console.log('  SKIP  개인 데이터 툴(토큰 없음 — MCP_TOKEN 설정 시 점검)')
  }

  console.log(`\n  결과: ${pass} pass / ${fail} fail\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })

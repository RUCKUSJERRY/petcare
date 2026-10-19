// 멀티에이전트 오케스트레이션 데모 (CLI). 케어 코디네이터가 질의를 전문 에이전트에 라우팅·위임하고
// RAG 근거를 붙여 결과를 합친다. 기본은 오프라인(키워드 라우팅 + lexical 그라운딩, LLM 없이 결정적).
//
// 실행:
//   npm run agents:demo
//   npm run agents:demo -- "사료 바꾸고 토하는데 양치는 언제"
//
// TS/JSON 은 Vite ssrLoadModule 로 로드(기존 의존성만).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const DEFAULT_QUERIES = [
  '우리 고양이가 소변을 못 보고 화장실만 들락거려요',
  '사료 바꾸는 방법이랑 양치 주기 알려줘',
  '이번 주 산책 몇 번 했어',
]

async function main() {
  const typed = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const qs = typed.length ? typed : DEFAULT_QUERIES

  const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, plugins: [tsconfigPaths()] })
  try {
    const orch = await server.ssrLoadModule('/src/lib/ai/agents/orchestrator.ts')
    const router = await server.ssrLoadModule('/src/lib/ai/agents/router.ts')
    const runnerMod = await server.ssrLoadModule('/src/lib/ai/agents/runner.ts')
    const retr = await server.ssrLoadModule('/src/lib/ai/rag/retriever.ts')

    const index = retr.buildRagIndex({ maxChars: 300 })
    const deps = {
      route: q => router.routeByKeywords(q, 2),
      runAgent: runnerMod.makeGroundedMockRunner(index),
      synthesize: orch.concatSynthesize,
    }

    console.log('\n  케어 코디네이터 — 멀티에이전트 오케스트레이션 (오프라인: 키워드 라우팅 + RAG 그라운딩)\n')
    for (const q of qs) {
      const r = await orch.orchestrate(q, deps)
      console.log(`  Q: ${q}`)
      console.log(`     라우팅 > ${r.routedTo.join(', ')}`)
      for (const res of r.results) {
        const cites = res.citations.length ? `  (근거: ${res.citations.map(c => c.title).join(', ')})` : ''
        console.log(`       - ${res.answer}${cites}`)
      }
      console.log('')
    }
    console.log('  (실제 LLM 실행·합성: runner.makeLlmAgentRunner + buildSynthesisPrompt, 모델 키 필요)\n')
  } finally {
    await server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

// RAG 검색 품질 Eval (CLI). 라벨셋(질의>관련 문서)에 retriever 를 돌려 recall@k·MRR·nDCG 를 낸다.
//
// 실행:
//   npm run rag:eval            # lexical(BM25) 베이스라인 (오프라인)
//   npm run rag:eval -- --live  # lexical vs vector vs hybrid 비교 (임베딩 모델 키 필요)
//
// --live 는 임베딩 provider(모델 레지스트리)가 구성돼야 돈다. 없으면 lexical 만 출력.
// TS/JSON 은 Vite ssrLoadModule 로 로드(기존 의존성만).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const pct = n => `${(n * 100).toFixed(1)}%`.padStart(7)

function printReport(r) {
  console.log(
    `  ${r.label.padEnd(10)}  recall@${r.k} ${pct(r.macro.recall)}   MRR ${pct(r.macro.mrr)}   nDCG@${r.k} ${pct(r.macro.ndcg)}   P@${r.k} ${pct(r.macro.precision)}`,
  )
}

async function main() {
  const live = process.argv.includes('--live')
  const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, plugins: [tsconfigPaths()] })
  try {
    const retr = await server.ssrLoadModule('/src/lib/ai/rag/retriever.ts')
    const evalMod = await server.ssrLoadModule('/src/lib/ai/rag/evalRetrieval.ts')
    const dsMod = await server.ssrLoadModule('/src/lib/ai/rag/dataset/retrieval.json')
    const dataset = dsMod.default ?? dsMod

    const index = retr.buildRagIndex({ maxChars: 300 })
    console.log(`\n  RAG 검색 품질 — dataset: ${dataset.name}  (${dataset.cases.length} queries, k=${dataset.k})\n`)

    const lexical = await evalMod.runRetrievalEval(dataset, evalMod.lexicalDocRetriever(index), 'lexical')
    printReport(lexical)

    if (live) {
      let embed
      try { embed = await server.ssrLoadModule('/src/lib/ai/rag/embed.ts') } catch { embed = null }
      if (!embed || !(await embed.embeddingAvailable())) {
        console.log('\n  --live: 임베딩 provider 가 구성되지 않았습니다. 키를 설정하세요.')
        console.log('  예) OPENAI_API_KEY (text-embedding-3-small) / UPSTAGE_API_KEY (embedding-query) 등\n')
      } else {
        const built = await embed.embedIndex(index)
        const vectorR = await evalMod.runRetrievalEval(dataset, embed.vectorDocRetriever(index, built), 'vector')
        printReport(vectorR)
        const hybridR = await evalMod.runRetrievalEval(dataset, embed.hybridDocRetriever(index, built), 'hybrid')
        printReport(hybridR)
        // 리랭킹: 하이브리드 후보를 LLM 으로 재정렬(모델 구성 시)
        const rerankMod = await server.ssrLoadModule('/src/lib/ai/rag/rerank.ts')
        const reranker = rerankMod.getDefaultReranker()
        if (reranker) {
          const candidates = embed.hybridChunkRetriever(index, built)
          const rerankR = await evalMod.runRetrievalEval(dataset, rerankMod.makeRerankedDocRetriever(candidates, reranker), 'rerank')
          printReport(rerankR)
        } else {
          console.log('  (rerank: 챗 모델 미구성 — 건너뜀)')
        }
      }
    } else {
      console.log('\n  (vector/hybrid 비교: npm run rag:eval -- --live, 임베딩 키 필요)')
    }
    console.log('')
  } finally {
    await server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

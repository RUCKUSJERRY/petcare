// RAG 검색 데모 (CLI). 앱 큐레이션 코퍼스에 lexical(BM25) 검색을 돌려 상위 청크를 보여준다.
//
// 실행:
//   npm run rag:demo               # 기본 질의 몇 개로 시연
//   npm run rag:demo -- "강아지 양치 어떻게 해"   # 직접 질의
//
// lexical 은 임베딩 없이 오프라인으로 동작한다. vector/hybrid 는 임베딩(모델 호출)을 주입해야 하며
// 다음 단계(임베딩 생성 + pgvector)에서 연결한다.
//
// TS/JSON 은 Vite ssrLoadModule 로 로드(기존 의존성만 사용).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const DEFAULT_QUERIES = [
  '강아지 양치 어떻게 해',
  '여름에 산책 조심할 점',
  '고양이 토하는데 병원 가야 하나',
  '사료 고를 때 뭘 봐야 해',
]

async function main() {
  const queries = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const qs = queries.length > 0 ? queries : DEFAULT_QUERIES

  const server = await createServer({
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    plugins: [tsconfigPaths()],
  })
  try {
    const { buildRagIndex } = await server.ssrLoadModule('/src/lib/ai/rag/retriever.ts')
    const index = buildRagIndex({ maxChars: 300 })
    console.log(`\n  RAG 데모 — 코퍼스 ${index.chunks.length} 청크 (lexical/BM25, 오프라인)\n`)
    for (const q of qs) {
      console.log(`  Q: ${q}`)
      const hits = index.searchLexical(q, 3)
      if (hits.length === 0) {
        console.log('     (관련 문서 없음)\n')
        continue
      }
      for (const h of hits) {
        const snippet = h.item.text.replace(/\n/g, ' ').slice(0, 70)
        console.log(`     [${h.score.toFixed(2)}] (${h.item.source}) ${h.item.title} — ${snippet}…`)
      }
      console.log('')
    }
  } finally {
    await server.close()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

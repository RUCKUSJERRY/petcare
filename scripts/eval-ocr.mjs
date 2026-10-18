// OCR 추출 Eval 러너 (CLI). 데이터셋을 예측기로 돌려 레코드 P/R/F1 + 필드 정확도를 출력한다.
//
// 실행:
//   npm run eval:ocr            # 오프라인 fixture(네트워크 없이 결정적 — 저장된 스냅샷 재생)
//   npm run eval:ocr -- --live  # 구성된 각 모델로 실제 추출해 F1 + 비용 + 지연 비교
//
// --live 는 env 에 키가 설정된 provider(src/lib/ai/models)만 돈다. 채점/비용은 fixture 와 동일
// 코드라 모델 간 공정 비교가 된다(품질=F1, 비용=토큰 x 단가, 지연).
//
// TS/JSON 모듈은 Vite 의 ssrLoadModule 로 로드한다(프로젝트 기존 의존성만 사용 — 별도 빌드 불필요).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const pct = n => `${(n * 100).toFixed(1)}%`.padStart(6)
const usd = n => (n == null ? '   n/a' : `$${n.toFixed(4)}`.padStart(6))
const ms = n => (n == null ? '  n/a' : `${n}ms`.padStart(6))

async function loadModules(server) {
  const run = await server.ssrLoadModule('/src/lib/ai/eval/runOcrEval.ts')
  const live = await server.ssrLoadModule('/src/lib/ai/eval/livePredictor.ts')
  const registry = await server.ssrLoadModule('/src/lib/ai/models/registry.ts')
  const datasetMod = await server.ssrLoadModule('/src/lib/ai/eval/dataset/ocr.json')
  return { run, live, registry, dataset: datasetMod.default ?? datasetMod }
}

function printReport(report, label) {
  console.log(`\n  OCR Eval — dataset: ${report.dataset}  (${label})\n`)
  console.log('  case                            P      R     F1   | date  type  cat  cost  name')
  console.log('  ' + '-'.repeat(82))
  for (const c of report.cases) {
    const f = c.fields
    console.log(
      `  ${c.id.padEnd(30)} ${pct(c.precision)}${pct(c.recall)}${pct(c.f1)} |` +
      `${pct(f.date)}${pct(f.type)}${pct(f.category)}${pct(f.cost)}${pct(f.name)}`,
    )
  }
  const m = report.macro
  console.log('  ' + '-'.repeat(82))
  console.log(
    `  ${'MACRO (case avg)'.padEnd(30)} ${pct(m.precision)}${pct(m.recall)}${pct(m.f1)} |` +
    `${pct(m.fields.date)}${pct(m.fields.type)}${pct(m.fields.category)}${pct(m.fields.cost)}${pct(m.fields.name)}`,
  )
  console.log('')
}

async function runFixture({ run, dataset }) {
  const report = await run.runOcrEval(dataset, run.fixturePredictor)
  printReport(report, 'predictor: fixture/offline')
}

async function runLive({ run, live, registry, dataset }) {
  const specs = registry.specsFromEnv()
  if (specs.length === 0) {
    console.log('\n  --live: 구성된 모델이 없습니다. env 에 provider 키를 설정하세요.')
    console.log('  예) UPSTAGE_API_KEY / OPENAI_API_KEY / GROQ_API_KEY / GEMINI_API_KEY / OLLAMA_BASE_URL')
    console.log('  (.env.local.example 의 "AI 챗봇 · 멀티 provider" 참고)\n')
    return
  }
  console.log(`\n  OCR Eval — LIVE 모델 비교 (dataset: ${dataset.name}, ${dataset.cases.length} cases)\n`)
  console.log('  model                                       F1      P      R    cost    avgLat   ok')
  console.log('  ' + '-'.repeat(86))
  for (const spec of specs) {
    const calls = []
    const predictor = live.makeLivePredictor(spec, calls)
    let report
    try {
      report = await run.runOcrEval(dataset, predictor)
    } catch (e) {
      console.log(`  ${spec.id.padEnd(40)} 오류: ${String(e?.message ?? e).slice(0, 30)}`)
      continue
    }
    const s = live.summarizeCalls(spec, calls)
    console.log(
      `  ${spec.id.padEnd(40)} ${pct(report.macro.f1)}${pct(report.macro.precision)}${pct(report.macro.recall)}` +
      ` ${usd(s.costUsd)} ${ms(s.avgLatencyMs)}  ${s.successes}/${s.calls}`,
    )
  }
  console.log('  ' + '-'.repeat(86))
  console.log('  (cost=토큰 x 단가 USD, 단가 미설정 모델은 n/a. 단가는 cost.ts/AI_PRICE_* 로 설정)\n')
}

async function main() {
  const liveMode = process.argv.includes('--live')
  const server = await createServer({
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    plugins: [tsconfigPaths()],
  })
  try {
    const mods = await loadModules(server)
    if (liveMode) await runLive(mods)
    else await runFixture(mods)
  } finally {
    await server.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

// OCR 추출 Eval 러너 (CLI). 데이터셋을 예측기로 돌려 레코드 P/R/F1 + 필드 정확도를 출력한다.
//
// 실행: npm run eval:ocr
//
// 기본은 오프라인 fixture 예측기(네트워크 없이 결정적 — 데이터셋에 저장된 스냅샷 재생).
// 라이브 모델 비교(Upstage/Gemini 등)는 멀티모델 단계에서 predict 를 실제 추출로 바꿔 끼우면 된다
// (runOcrEval(dataset, livePredictor)). 채점/집계는 동일 코드라 공정 비교가 된다.
//
// TS/JSON 모듈은 Vite 의 ssrLoadModule 로 로드한다(프로젝트 기존 의존성만 사용 — 별도 빌드 불필요).

import { createServer } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const pct = n => `${(n * 100).toFixed(1)}%`.padStart(6)

async function main() {
  const server = await createServer({
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    plugins: [tsconfigPaths()],
  })
  try {
    const { runOcrEval, fixturePredictor } = await server.ssrLoadModule('/src/lib/ai/eval/runOcrEval.ts')
    const datasetMod = await server.ssrLoadModule('/src/lib/ai/eval/dataset/ocr.json')
    const dataset = datasetMod.default ?? datasetMod

    const report = await runOcrEval(dataset, fixturePredictor)

    console.log(`\n  OCR Eval — dataset: ${report.dataset}  (predictor: fixture/offline)\n`)
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
  } finally {
    await server.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

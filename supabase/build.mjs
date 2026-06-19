#!/usr/bin/env node
// =============================================================
//  supabase/build.mjs
//  02_final/ 의 오브젝트별 SQL을 "올바른 실행 순서"로 이어붙여
//  01_operation/01.1_initial/00_full_setup.sql (신규 DB 통합 세팅본)을 생성한다.
//
//  사용: npm run db:build   (또는 node supabase/build.mjs)
//
//  실행 순서 규칙:
//   - 02_final 하위 카테고리 폴더(02.1_table, 02.2_index_fk, ...)를
//     번호 오름차순으로 처리한다. (이 순서가 곧 의존성 순서)
//   - 각 폴더 안의 *.sql 파일은 파일명 알파벳 순으로 이어붙인다.
//     (테이블 생성 순서에 의존하지 않도록 FK는 02.2로 분리되어 있다)
// =============================================================
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const finalDir = join(here, '02_final')
const outDir = join(here, '01_operation', '01.1_initial')
const outFile = join(outDir, '00_full_setup.sql')

// 02.1, 02.2 ... 형태의 카테고리 폴더를 번호 순으로 정렬
const numOf = name => {
  const m = name.match(/^0?\d+\.(\d+)/)
  return m ? Number(m[1]) : 9999
}

function listSql(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
}

const categories = readdirSync(finalDir)
  .filter(name => statSync(join(finalDir, name)).isDirectory())
  .sort((a, b) => numOf(a) - numOf(b) || a.localeCompare(b))

const parts = []
parts.push('-- =============================================================')
parts.push('--  00_full_setup.sql  — 신규 DB 통합 세팅본 (자동 생성)')
parts.push('--  ⚠ 직접 수정하지 마세요. supabase/02_final/* 를 수정한 뒤')
parts.push('--     `npm run db:build` 로 재생성합니다.')
parts.push(`--  생성 시각: ${new Date().toISOString()}`)
parts.push('-- =============================================================')
parts.push('')

let fileCount = 0
for (const cat of categories) {
  const catDir = join(finalDir, cat)
  const files = listSql(catDir)
  if (files.length === 0) continue
  parts.push('')
  parts.push(`-- ┌──────────────────────────────────────────────`)
  parts.push(`-- │ ${cat}`)
  parts.push(`-- └──────────────────────────────────────────────`)
  for (const f of files) {
    parts.push('')
    parts.push(`-- ── ${cat}/${f} ──`)
    parts.push(readFileSync(join(catDir, f), 'utf8').trimEnd())
    fileCount++
  }
}
parts.push('')

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, parts.join('\n'))
console.log(`✓ ${fileCount}개 파일 → ${outFile.replace(here + '/', 'supabase/')}`)

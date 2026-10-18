import type { RagChunk, RagDoc } from './types'

/**
 * 청킹 — 문서 본문을 검색 단위(passage)로 쪼갠다.
 *
 * 전략: 줄(문단) 경계를 지키며 maxChars 까지 greedy 로 묶고, 청크 사이에 overlapChars 만큼 겹친다
 * (경계에서 맥락이 끊겨 검색이 놓치는 것을 줄이기 위함). 한 줄이 maxChars 보다 길면 글자 단위로 쪼갠다.
 * 순수·결정적.
 */

export interface ChunkOptions {
  maxChars?: number
  overlapChars?: number
}

const DEFAULTS: Required<ChunkOptions> = { maxChars: 400, overlapChars: 80 }

/** 직전 청크의 끝에서 overlap 길이만큼 꼬리를 떼어 다음 청크 앞에 붙일 텍스트(가능하면 공백 경계에서). */
function overlapTail(prev: string, overlap: number): string {
  if (overlap <= 0 || prev.length <= overlap) return prev.length <= overlap ? prev : ''
  const tail = prev.slice(prev.length - overlap)
  const sp = tail.indexOf(' ')
  return sp > 0 ? tail.slice(sp + 1) : tail
}

/** 긴 한 줄을 maxChars 조각으로 하드 분할. */
function hardSplit(line: string, maxChars: number): string[] {
  const out: string[] = []
  for (let i = 0; i < line.length; i += maxChars) out.push(line.slice(i, i + maxChars))
  return out
}

/** 텍스트를 청크 문자열 배열로. */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const { maxChars, overlapChars } = { ...DEFAULTS, ...opts }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const chunks: string[] = []
  let cur = ''
  const flush = () => { if (cur) { chunks.push(cur); cur = '' } }

  for (const rawLine of lines) {
    const pieces = rawLine.length > maxChars ? hardSplit(rawLine, maxChars) : [rawLine]
    for (const line of pieces) {
      if (!cur) { cur = line; continue }
      if (cur.length + 1 + line.length > maxChars) {
        const prev = cur
        flush()
        const tail = overlapTail(prev, overlapChars)
        cur = tail ? `${tail}\n${line}` : line
      } else {
        cur = `${cur}\n${line}`
      }
    }
  }
  flush()
  return chunks
}

/** 문서 1개를 청크들로. */
export function chunkDoc(doc: RagDoc, opts: ChunkOptions = {}): RagChunk[] {
  return chunkText(doc.text, opts).map((text, i) => ({
    id: `${doc.id}#${i}`,
    docId: doc.id,
    source: doc.source,
    title: doc.title,
    text,
    href: doc.href,
    metadata: doc.metadata,
  }))
}

/** 코퍼스 전체 청킹(결정적 순서). */
export function chunkCorpus(docs: RagDoc[], opts: ChunkOptions = {}): RagChunk[] {
  return docs.flatMap(d => chunkDoc(d, opts))
}

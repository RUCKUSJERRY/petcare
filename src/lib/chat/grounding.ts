import { buildRagIndex, type RagIndex } from '@/lib/ai/rag/retriever'

/**
 * 챗봇 RAG 근거 — 사용자 질문에 관련된 앱 큐레이션 가이드 구절을 찾아 시스템 프롬프트에 주입한다.
 * 답변을 '우리 정보 페이지'에 정렬시켜 환각을 줄이고 출처를 안내할 수 있게 한다.
 *
 * lexical 검색(오프라인·결정적·키 불필요)을 쓴다. 코퍼스는 50청크 수준이라 인덱스는 한 번만 만든다.
 */

let _index: RagIndex | null = null
function index(): RagIndex {
  if (!_index) _index = buildRagIndex({ maxChars: 300 })
  return _index
}

export interface GroundingPassage {
  title: string
  href: string
  text: string
}

/** 질문에 관련된 상위 구절. 빈 질문/무관하면 빈 배열. */
export function retrieveGrounding(query: string, topK = 3): GroundingPassage[] {
  if (!query.trim()) return []
  return index()
    .searchLexical(query, topK * 3)
    .slice(0, topK)
    .map(h => ({ title: h.item.title, href: h.item.href, text: h.item.text }))
}

/** 근거 구절들을 시스템 프롬프트에 덧붙일 블록으로(순수). 비면 빈 문자열. */
export function groundingText(passages: GroundingPassage[]): string {
  if (passages.length === 0) return ''
  const blocks = passages
    .map((p, i) => `[참고${i + 1}] ${p.title} (${p.href})\n${p.text}`)
    .join('\n\n')
  return [
    '',
    '참고 정보(앱의 돌봄 가이드에서 질문과 관련해 찾은 내용):',
    '- 답변이 이 내용과 어긋나지 않게 하고, 적절하면 출처 화면을 자연스럽게 안내한다.',
    '- 관련이 없으면 무시하고 일반 지식으로 답한다.',
    blocks,
  ].join('\n')
}

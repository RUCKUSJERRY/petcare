import { buildRagIndex, type RagIndex } from '../rag/retriever'
import { makeGroundedMockRunner } from '../agents/runner'
import { getAgent } from '../agents/registry'
import { type McpUserContext, myPetsText, myWalkSummaryText, myCostsText, myUpcomingCareText } from './userData'

/**
 * MCP 툴 — petcare 의 '공개 반려동물 지식'을 외부 MCP 클라이언트(Claude Desktop 등)에 노출한다.
 *
 * 읽기전용 + 큐레이션 콘텐츠만 쓰므로 인증·PII 가 없다(사용자 기록은 노출하지 않음 — 그건 인증이 필요해
 * 다음 단계). 내부적으로 앞서 만든 RAG 검색·증상 트리아지 에이전트를 재사용한다.
 *
 * 각 툴은 name·description·inputSchema(JSON Schema)·handler(args>텍스트)로 정의된다. 핸들러는
 * 결정적(오프라인 lexical/그라운딩)이라 테스트로 고정된다.
 */

export interface McpToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<string>
}

const SOURCES = ['care', 'food', 'symptom', 'seasonal'] as const

// RAG 인덱스는 무겁지 않지만 한 번만 만든다(모듈 싱글턴).
let _index: RagIndex | null = null
function index(): RagIndex {
  if (!_index) _index = buildRagIndex({ maxChars: 300 })
  return _index
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '')
const asInt = (v: unknown, def: number): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : def
}

/** 공개 지식 툴(인증 불필요). 누구나 쓸 수 있는 큐레이션 콘텐츠 기반. */
export const PUBLIC_TOOLS: McpToolDef[] = [
  {
    name: 'search_pet_care_knowledge',
    description: '반려동물 돌봄 지식(양치·사료·증상·계절 케어 등)을 큐레이션 코퍼스에서 검색해 관련 구절과 출처 링크를 돌려준다.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색할 질문/키워드' },
        source: { type: 'string', enum: SOURCES, description: '선택: 특정 영역으로 한정(care/food/symptom/seasonal)' },
        topK: { type: 'integer', description: '선택: 반환 개수(기본 3, 최대 10)' },
      },
      required: ['query'],
    },
    handler: async args => {
      const query = asString(args.query).trim()
      if (!query) throw new Error('query 가 필요해요.')
      const source = SOURCES.includes(args.source as never) ? (args.source as string) : null
      const topK = asInt(args.topK, 3)
      const hits = index().searchLexical(query, topK * 4)
        .filter(h => !source || h.item.source === source)
        .slice(0, topK)
      if (hits.length === 0) return `"${query}" 에 대한 관련 지식을 찾지 못했어요.`
      return hits
        .map((h, i) => `${i + 1}. [${h.item.source}] ${h.item.title} (${h.item.href})\n   ${h.item.text.replace(/\n/g, ' ').slice(0, 200)}`)
        .join('\n')
    },
  },
  {
    name: 'list_knowledge_topics',
    description: '검색 가능한 반려동물 지식 주제 목록을 영역별로 돌려준다.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: SOURCES, description: '선택: 특정 영역만' },
      },
    },
    handler: async args => {
      const source = SOURCES.includes(args.source as never) ? (args.source as string) : null
      // 코퍼스 문서 제목을 영역별로 중복 없이 모은다.
      const seen = new Set<string>()
      const lines: string[] = []
      for (const c of index().chunks) {
        if (source && c.source !== source) continue
        const key = `${c.source}:${c.title}`
        if (seen.has(key)) continue
        seen.add(key)
        lines.push(`- [${c.source}] ${c.title}`)
      }
      return lines.join('\n')
    },
  },
  {
    name: 'triage_pet_symptom',
    description: '반려동물 증상을 설명하면, 큐레이션 증상 가이드를 근거로 관련 항목과 출처를 안내한다. 수의학적 진단이 아니며 응급 신호는 즉시 병원 방문을 권한다.',
    inputSchema: {
      type: 'object',
      properties: {
        symptom: { type: 'string', description: '관찰된 증상 설명(예: "자꾸 토하고 기운이 없어요")' },
      },
      required: ['symptom'],
    },
    handler: async args => {
      const symptom = asString(args.symptom).trim()
      if (!symptom) throw new Error('symptom 이 필요해요.')
      const spec = getAgent('symptom-triage')!
      const res = await makeGroundedMockRunner(index())(spec, { query: symptom })
      const cites = res.citations.length ? `\n출처: ${res.citations.map(c => `${c.title} (${c.href})`).join(', ')}` : ''
      return `${res.answer}${cites}\n\n⚠ 일반 정보이며 수의학적 진단이 아니에요. 응급·위험 신호가 보이면 즉시 동물병원에 가세요.`
    },
  },
]

/** 하위호환: 기존 참조는 공개 툴 집합을 가리킨다. */
export const MCP_TOOLS = PUBLIC_TOOLS

/**
 * 사용자 데이터 툴(인증 필요). 토큰 주인(ctx.userId)이 구성원인 반려동물로만 엄격히 범위 제한
 * (userData 모듈이 pet_members 기준으로 격리). ctx 없으면 노출되지 않는다.
 */
function userTools(ctx: McpUserContext): McpToolDef[] {
  return [
    {
      name: 'get_my_pets',
      description: '토큰 주인의 반려동물 목록을 돌려준다.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => myPetsText(ctx),
    },
    {
      name: 'get_my_walk_summary',
      description: '내 반려동물의 산책 요약(이번 주/이번 달/전체)을 돌려준다.',
      inputSchema: { type: 'object', properties: { petName: { type: 'string', description: '선택: 아이 이름(여러 마리면 필요)' } } },
      handler: args => myWalkSummaryText(ctx, asString(args.petName) || undefined),
    },
    {
      name: 'get_my_costs',
      description: '내 반려동물의 연간 비용 요약(총액·지출 큰 항목)을 돌려준다.',
      inputSchema: {
        type: 'object',
        properties: {
          petName: { type: 'string', description: '선택: 아이 이름' },
          year: { type: 'integer', description: '선택: 연도(기본 올해)' },
        },
      },
      handler: args => myCostsText(ctx, asString(args.petName) || undefined, typeof args.year === 'number' ? args.year : undefined),
    },
    {
      name: 'get_my_upcoming_care',
      description: '내 반려동물의 다가오는 건강 관리 일정(접종·구충·심장사상충 등)을 돌려준다.',
      inputSchema: { type: 'object', properties: { petName: { type: 'string', description: '선택: 아이 이름' } } },
      handler: args => myUpcomingCareText(ctx, asString(args.petName) || undefined),
    },
  ]
}

/** 요청 컨텍스트에 맞는 전체 툴 목록(공개 + 인증 시 사용자 데이터). */
export function buildMcpTools(ctx?: McpUserContext | null): McpToolDef[] {
  return ctx ? [...PUBLIC_TOOLS, ...userTools(ctx)] : PUBLIC_TOOLS
}

export function getMcpTool(name: string, ctx?: McpUserContext | null): McpToolDef | undefined {
  return buildMcpTools(ctx).find(t => t.name === name)
}

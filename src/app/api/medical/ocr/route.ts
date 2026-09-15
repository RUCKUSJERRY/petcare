import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUserPremiumServer } from '@/lib/plan'
import { getFreeOcrMonthlyServer, getOcrProviderOrderServer, type OcrProvider } from '@/lib/settings'
import { todayKST } from '@/lib/utils'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Gemini 모델 (무료 등급 가능). 필요 시 GEMINI_MODEL로 교체.
// gemini-2.0-flash 는 폐기되어 404 (API가 gemini-3.6-flash 로 안내) → 현행 모델로 기본값 갱신.
// (Gemini 는 폴백 provider. 값이 또 바뀌면 GEMINI_MODEL env 로 교체.)
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

// 업스테이지 Information Extract (OpenAI 호환 chat.completions). 모델·엔드포인트는 env로 교체 가능.
// 엔드포인트 경로는 콘솔 문서 기준으로 확정하되, 다르면 UPSTAGE_OCR_URL 한 줄로 교정한다.
const UPSTAGE_MODEL = process.env.UPSTAGE_MODEL || 'information-extract'
// Information Extract 전용 엔드포인트. 범용 /v1/chat/completions 는 Solar 챗 모델만 받아
// information-extract 모델에 400(model invalid)을 준다 → IE 전용 경로로 호출한다.
// 문서 기준과 다르면 UPSTAGE_OCR_URL 한 줄로 교정.
const UPSTAGE_OCR_URL = process.env.UPSTAGE_OCR_URL || 'https://api.upstage.ai/v1/information-extraction/chat/completions'

type OcrRecord = Record<string, unknown>
type ProviderResult = { records: OcrRecord[] } | { error: 'not_configured' | 'rate_limited' | 'failed' }

/**
 * imageUrl이 우리 Supabase 스토리지의 public 객체 URL인지 검증한다.
 * 클라이언트가 보낸 임의 URL을 그대로 fetch하면 SSRF(내부망/메타데이터 접근)
 * 위험이 있으므로, origin이 프로젝트 Supabase URL과 같고 public 객체 경로일 때만 허용.
 */
function isAllowedImageUrl(raw: string): boolean {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supaUrl) return false
  try {
    const u = new URL(raw)
    const base = new URL(supaUrl)
    if (u.protocol !== 'https:') return false
    if (u.host !== base.host) return false
    return u.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

// 한 이미지에서 여러 건(이력서·접종증명서 등)을 추출하기 위한 배열 스키마.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    records: {
      type: 'array',
      description: '이미지에서 인식된 진료/관리 항목들. 영수증 1장이면 1건, 이력서/증명서면 여러 건.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['medical', 'care'], description: "병원 진료/검사/수술이면 'medical', 접종/구충/심장사상충/외부기생충/건강검진/미용/양치/발톱/목욕/귀청소면 'care'" },
          date: { type: 'string', description: '시행/진료일 YYYY-MM-DD. 연도 불명확하면 빈 문자열' },
          clinic: { type: 'string', description: '병원/업체명. 없으면 빈 문자열' },
          category: { type: 'string', description: "care일 때만: 접종/심장사상충/구충/외부기생충/건강검진/미용/양치/발톱/목욕/귀청소/기타 중 하나. medical이면 빈 문자열" },
          name: { type: 'string', description: 'care: 항목명/백신명(예: 종합백신 DHPPL). medical: 진단명 또는 내원사유 요약' },
          next_due: { type: 'string', description: '다음 예정일이 적혀 있으면 YYYY-MM-DD, 없으면 빈 문자열' },
          reason: { type: 'string', description: 'medical: 증상/내원 사유. 없으면 빈 문자열' },
          diagnosis: { type: 'string', description: 'medical: 진단명. 없으면 빈 문자열' },
          treatment: { type: 'string', description: 'medical: 처치/검사 항목 요약(쉼표). 없으면 빈 문자열' },
          medication: { type: 'string', description: 'medical: 처방약. 없으면 빈 문자열' },
          cost: { type: 'integer', description: '해당 건 금액(원, 숫자만). 없으면 0' },
        },
        required: ['type', 'date', 'category', 'name', 'cost'],
      },
    },
  },
  required: ['records'],
}

const PROMPT = `너는 동물병원 영수증·세부내역서·진료이력서·접종증명서 이미지를 분석하는 보조 도구야.
이미지에 여러 날짜/항목이 리스트로 적혀 있을 수 있으니, 보이는 모든 건을 각각의 record로 추출해 JSON으로만 답해.
- 단일 영수증이면 보통 1건, 진료이력서/접종증명서면 날짜별로 여러 건이 될 수 있어.
- 각 건을 'medical'(병원 진료/검사/수술/처치) 또는 'care'(접종/구충/심장사상충/외부기생충/건강검진/미용/양치/발톱/목욕/귀청소)로 분류해.
- date는 YYYY-MM-DD. 연도가 불명확하면 빈 문자열로 두고 추측하지 마.
- cost는 콤마·'원' 제거한 숫자. 합계만 있으면 합계를 첫 건에 넣어도 돼.
- 확실하지 않은 값은 비워 둬(빈 문자열 또는 0). 없는 정보를 지어내지 마.`

/** Gemini(LLM)로 구조화 추출. 실패/미설정/쿼터초과면 error 사유 반환 */
async function tryGemini(base64: string, mimeType: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { error: 'not_configured' }
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    // Gemini가 응답을 지연하면 maxDuration까지 요청이 묶여 클라이언트의 무료 OCR(Tesseract)
    // 폴백도 늦어진다. 타임아웃을 두어 빠르게 실패시키고 폴백이 동작하도록 한다.
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[ocr] gemini error', res.status, detail.slice(0, 200))
      return { error: res.status === 429 ? 'rate_limited' : 'failed' }
    }
    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return { error: 'failed' }
    const parsed = JSON.parse(text)
    const records = Array.isArray(parsed?.records) ? parsed.records : []
    if (records.length === 0) return { error: 'failed' }
    return { records }
  } catch (err) {
    console.error('[ocr] gemini exception', err)
    return { error: 'failed' }
  }
}

/** 업스테이지 Information Extract(OpenAI 호환)로 구조화 추출. Gemini 와 동일한 records 스키마를 요구한다. */
async function tryUpstage(base64: string, mimeType: string): Promise<ProviderResult> {
  const apiKey = process.env.UPSTAGE_API_KEY
  if (!apiKey) return { error: 'not_configured' }
  try {
    const res = await fetch(UPSTAGE_OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: UPSTAGE_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        // OpenAI 호환 구조화 출력 — 우리 records 스키마를 그대로 요구한다.
        response_format: { type: 'json_schema', json_schema: { name: 'records', schema: RESPONSE_SCHEMA } },
      }),
      // Gemini 와 동일하게 빠르게 실패시켜 폴백(다른 provider·Tesseract)이 늦지 않게 한다.
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[ocr] upstage error', res.status, detail.slice(0, 200))
      return { error: res.status === 429 ? 'rate_limited' : 'failed' }
    }
    const data = await res.json()
    // OpenAI 호환 응답: choices[0].message.content 안에 JSON 문자열이 담긴다.
    const text: string | undefined = data?.choices?.[0]?.message?.content
    if (!text) return { error: 'failed' }
    const parsed = JSON.parse(text)
    const records = Array.isArray(parsed?.records) ? parsed.records : []
    if (records.length === 0) return { error: 'failed' }
    return { records }
  } catch (err) {
    console.error('[ocr] upstage exception', err)
    return { error: 'failed' }
  }
}

/**
 * provider 우선순위대로 시도한다(upstage↔gemini). primary 가 미설정/한도/실패면 secondary 로 폴백.
 * - 어느 하나라도 records 를 주면 그걸 사용(source 표기).
 * - 모두 실패면 가장 설명적인 사유를 반환: 실제 모델이 돌아간 'failed' > 쿼터 'rate_limited' > 'not_configured'.
 *   (호출부는 이 사유로 과금 여부·클라이언트 폴백 메시지를 정한다.)
 */
async function runExtraction(
  base64: string, mimeType: string, order: OcrProvider[],
): Promise<{ records: OcrRecord[]; source: OcrProvider } | { error: 'not_configured' | 'rate_limited' | 'failed' }> {
  const run = (p: OcrProvider) => (p === 'upstage' ? tryUpstage(base64, mimeType) : tryGemini(base64, mimeType))
  let worst: 'not_configured' | 'rate_limited' | 'failed' = 'not_configured'
  const rank = { not_configured: 0, rate_limited: 1, failed: 2 } as const
  for (const p of order) {
    const r = await run(p)
    if ('records' in r) return { records: r.records, source: p }
    if (rank[r.error] > rank[worst]) worst = r.error
  }
  return { error: worst }
}

// 사용자당 시간당 OCR 호출 상한 (외부 LLM 비용/쿼터 남용 방지)
const OCR_HOURLY_LIMIT = 30

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 서버측 레이트리밋: 최근 1시간 호출 수 확인 (클라이언트 쿨다운과 별개의 방어선)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countErr } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', 'ocr')
    .gte('created_at', since)
  // 카운트 조회 실패 시 fail-closed: 한도를 0으로 오인해 유료 Gemini 를 무제한 호출하지 않도록
  // 즉시 무료 인식(Tesseract) 폴백으로 유도한다. (사용자는 무료 인식으로 그대로 진행)
  if (countErr) {
    console.error('[ocr] usage count query failed', countErr)
    return NextResponse.json(
      { error: 'rate_limited', message: '지금은 AI 인식을 쓸 수 없어요. 무료 인식으로 대체할게요.', remaining: 0 },
      { status: 429 }
    )
  }
  const used = count ?? 0
  if (used >= OCR_HOURLY_LIMIT) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: 'AI 인식 한도를 모두 사용했어요. (시간당 30회) 무료 인식으로 대체할게요.',
        limit: OCR_HOURLY_LIMIT,
        remaining: 0,
      },
      { status: 429 }
    )
  }
  // 이번 호출 이후 남는 AI 인식 횟수(이번 호출 1건 차감) — 기본은 시간당 한도 기준
  let remaining = Math.max(0, OCR_HOURLY_LIMIT - used - 1)

  // 무료 사용자는 월 무료 제공 횟수까지만 AI 인식. 초과 시 프리미엄 안내와 함께
  // 클라이언트의 무료 인식(브라우저 Tesseract)으로 폴백한다. (기능을 막지 않고 등급화)
  const premium = await isUserPremiumServer(supabase, user.id)
  if (!premium) {
    const monthLimit = await getFreeOcrMonthlyServer(supabase)
    const monthStart = `${todayKST().slice(0, 8)}01T00:00:00+09:00` // 이달 1일 0시(KST)
    const { count: monthCount, error: monthErr } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('kind', 'ocr')
      .gte('created_at', monthStart)
    // 월 사용량 조회 실패도 fail-closed — 유료 Gemini 남용을 막고 무료 인식으로 폴백.
    if (monthErr) {
      console.error('[ocr] monthly usage count query failed', monthErr)
      return NextResponse.json(
        { error: 'rate_limited', message: '지금은 AI 인식을 쓸 수 없어요. 무료 인식으로 대체할게요.', remaining: 0 },
        { status: 429 }
      )
    }
    const monthUsed = monthCount ?? 0
    if (monthUsed >= monthLimit) {
      return NextResponse.json(
        {
          error: 'free_limit_reached',
          message: `이번 달 무료 AI 인식(${monthLimit}회)을 모두 썼어요. 프리미엄이면 무제한이에요. 지금은 무료 인식으로 대체할게요.`,
          limit: monthLimit,
          remaining: 0,
          upsell: 'premium',
        },
        { status: 429 }
      )
    }
    // 무료 사용자에겐 "이번 호출 이후 이달 남은 무료 횟수"를 안내값으로 쓴다(더 체감되는 기준).
    remaining = Math.min(remaining, Math.max(0, monthLimit - monthUsed - 1))
  }

  let imageUrl: string | undefined
  try {
    imageUrl = (await req.json())?.imageUrl
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

  // SSRF 방지: 우리 스토리지의 public 객체 URL만 허용
  if (!isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: 'invalid imageUrl' }, { status: 400 })
  }

  // provider 우선순위(관리자 app_settings → env → 기본 upstage). 두 provider 키가 모두 없으면
  // 클라이언트가 무료 OCR(Tesseract)로 폴백하도록 신호만 보낸다.
  const providerOrder = await getOcrProviderOrderServer(supabase)
  if (!process.env.UPSTAGE_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'not_configured', message: 'AI 인식이 설정되지 않았어요.' },
      { status: 503 }
    )
  }

  // 이미지 내려받아 base64 인코딩
  let base64: string
  let mimeType: string
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('image fetch failed')
    mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    if (buf.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'image_too_large', message: '파일이 너무 커요.' }, { status: 413 })
    }
    base64 = buf.toString('base64')
  } catch {
    return NextResponse.json({ error: 'image_fetch_failed', message: '이미지를 불러오지 못했어요.' }, { status: 502 })
  }

  // 사용량 슬롯을 '유료 호출 직전'에 먼저 예약(선점)한다.
  // 예전엔 Gemini 응답(최대 15초) 이후에야 insert 해서, 그 사이 병렬 요청들이 모두 한도 검사를
  // 통과해 시간당/월 한도를 넘길 수 있었다(TOCTOU). 예약을 앞당겨 경합 창을 크게 줄인다.
  const { data: usageRow, error: usageErr } = await supabase
    .from('ai_usage').insert({ user_id: user.id, kind: 'ocr' }).select('id').maybeSingle()
  if (usageErr) console.error('[ocr] usage tracking insert failed', usageErr)

  const result = await runExtraction(base64, mimeType, providerOrder)

  // 과금 없는 경로면 예약을 되돌려, 무료 사용자의 한도가 헛되이 깎이지 않게 한다.
  //  - 'rate_limited'(429): 쿼터로 거절되어 과금 없음 → 예약 취소.
  //  - 'not_configured': 모델이 안 돌았으니 과금 없음 → 예약 취소.
  //  - 성공/'failed'(모델이 실행됨): provider 가 실행되어 과금 → 예약 유지.
  const costIncurred = 'records' in result || result.error === 'failed'
  if (!costIncurred && usageRow) {
    await supabase.from('ai_usage').delete().eq('id', usageRow.id)
  }

  if ('records' in result) {
    return NextResponse.json({ ok: true, records: result.records, source: result.source, limit: OCR_HOURLY_LIMIT, remaining })
  }

  // 모든 provider 실패/한도초과 → 클라이언트 무료 OCR 폴백 유도
  const message = result.error === 'rate_limited'
    ? 'AI 사용량 한도를 초과했어요. 무료 인식으로 대체할게요.'
    : '진료 내용을 인식하지 못했어요.'
  return NextResponse.json({ error: 'ocr_failed', message }, { status: 502 })
}

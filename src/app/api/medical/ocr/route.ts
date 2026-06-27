import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Gemini 모델 (무료 등급 가능). 필요 시 GEMINI_MODEL로 교체.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

type OcrRecord = Record<string, unknown>

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

/** 1차: Gemini(LLM)로 구조화 추출. 실패/미설정/쿼터초과면 null + 사유 반환 */
async function tryGemini(base64: string, mimeType: string): Promise<{ records: OcrRecord[] } | { error: 'not_configured' | 'rate_limited' | 'failed' }> {
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

// 사용자당 시간당 OCR 호출 상한 (외부 LLM 비용/쿼터 남용 방지)
const OCR_HOURLY_LIMIT = 30

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 서버측 레이트리밋: 최근 1시간 호출 수 확인 (클라이언트 쿨다운과 별개의 방어선)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', 'ocr')
    .gte('created_at', since)
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
  // 이번 호출 이후 남는 AI 인식 횟수(이번 호출 1건 차감)
  const remaining = Math.max(0, OCR_HOURLY_LIMIT - used - 1)

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

  // Gemini 미설정이면 클라이언트가 무료 OCR(Tesseract)로 폴백하도록 신호만 보낸다.
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'not_configured', message: 'AI 인식이 설정되지 않았어요.' },
      { status: 503 }
    )
  }

  // 여기부터 실제 Gemini(유료/쿼터) 호출 경로 — 레이트리밋 카운트 기록.
  // (기록 실패해도 OCR 자체는 진행)
  await supabase.from('ai_usage').insert({ user_id: user.id, kind: 'ocr' })

  // 이미지 내려받아 base64 인코딩
  let base64: string
  let mimeType: string
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('image fetch failed')
    mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    if (buf.byteLength > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'image_too_large', message: '이미지가 너무 커요.' }, { status: 413 })
    }
    base64 = buf.toString('base64')
  } catch {
    return NextResponse.json({ error: 'image_fetch_failed', message: '이미지를 불러오지 못했어요.' }, { status: 502 })
  }

  const gemini = await tryGemini(base64, mimeType)
  if ('records' in gemini) {
    return NextResponse.json({ ok: true, records: gemini.records, source: 'gemini', limit: OCR_HOURLY_LIMIT, remaining })
  }

  // Gemini 실패/한도초과 → 클라이언트 무료 OCR 폴백 유도
  const message = gemini.error === 'rate_limited'
    ? 'AI 사용량 한도를 초과했어요. 무료 인식으로 대체할게요.'
    : '진료 내용을 인식하지 못했어요.'
  return NextResponse.json({ error: 'ocr_failed', message }, { status: 502 })
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Gemini 모델 (무료 등급 가능). 필요 시 GEMINI_MODEL로 교체.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

// 진료 영수증/세부내역서에서 추출할 필드 스키마
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    visited_on: { type: 'string', description: '진료일 YYYY-MM-DD. 없으면 빈 문자열' },
    clinic: { type: 'string', description: '동물병원 이름. 없으면 빈 문자열' },
    reason: { type: 'string', description: '내원 사유/증상. 없으면 빈 문자열' },
    diagnosis: { type: 'string', description: '진단명. 없으면 빈 문자열' },
    treatment: { type: 'string', description: '처치/치료 항목 요약. 없으면 빈 문자열' },
    medication: { type: 'string', description: '처방약. 없으면 빈 문자열' },
    cost: { type: 'integer', description: '총 결제 금액(원), 숫자만. 없으면 0' },
  },
  required: ['visited_on', 'clinic', 'reason', 'diagnosis', 'treatment', 'medication', 'cost'],
}

const PROMPT = `너는 동물병원 진료 영수증·세부내역서 이미지를 분석하는 보조 도구야.
이미지에서 아래 정보를 추출해 JSON으로만 답해.
- visited_on: 진료/결제 날짜를 YYYY-MM-DD 형식으로. 연도가 없으면 추정하지 말고 빈 문자열.
- clinic: 병원 상호명.
- reason: 내원 사유나 증상이 적혀 있으면.
- diagnosis: 진단명이 적혀 있으면.
- treatment: 진료/처치 항목(예: 혈액검사, 엑스레이, 주사 등)을 쉼표로 요약.
- medication: 처방약 이름.
- cost: 총 결제금액을 숫자(원)로. 콤마·원 표기는 제거.
확실하지 않은 값은 비워 둬(빈 문자열 또는 0). 추측하지 마.`

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'not_configured', message: 'OCR 기능이 설정되지 않았어요. (GEMINI_API_KEY 필요)' },
      { status: 503 }
    )
  }

  let imageUrl: string | undefined
  try {
    imageUrl = (await req.json())?.imageUrl
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 })

  // 1) 이미지 내려받아 base64 인코딩
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

  // 2) Gemini 호출
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[ocr] gemini error', res.status, detail.slice(0, 300))
      return NextResponse.json(
        { error: 'ocr_failed', message: '진료 내용을 인식하지 못했어요. 직접 입력해주세요.' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return NextResponse.json({ error: 'empty_result', message: '인식 결과가 비어 있어요.' }, { status: 502 })
    }
    const fields = JSON.parse(text)
    return NextResponse.json({ ok: true, fields })
  } catch (err) {
    console.error('[ocr] error', err)
    return NextResponse.json(
      { error: 'ocr_failed', message: '진료 내용을 인식하지 못했어요. 직접 입력해주세요.' },
      { status: 502 }
    )
  }
}

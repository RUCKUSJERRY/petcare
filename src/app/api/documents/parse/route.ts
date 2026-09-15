import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isUserPremiumServer } from '@/lib/plan'
import { todayKST } from '@/lib/utils'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Upstage Document Parse (Document Digitization). 문서 → 레이아웃 보존 HTML/Markdown 구조화.
const UPSTAGE_PARSE_URL = process.env.UPSTAGE_PARSE_URL || 'https://api.upstage.ai/v1/document-digitization'
const UPSTAGE_PARSE_MODEL = process.env.UPSTAGE_PARSE_MODEL || 'document-parse'

// 남용/비용 방지 (Parse 는 유료: 약 $0.01/page)
const HOURLY_CAP = 20
const DEFAULT_FREE_PARSE_MONTHLY = 20

/** 우리 Supabase 스토리지 public 객체 URL만 허용(SSRF 방지) */
function isAllowedStorageUrl(raw: string): boolean {
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

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.UPSTAGE_API_KEY) {
    return NextResponse.json({ error: 'not_configured', message: '문서 정리가 아직 설정되지 않았어요.' }, { status: 503 })
  }

  // ── 사용량 제한 (ai_usage kind='parse'). 카운트 조회 실패는 fail-open(테이블 미적용 시에도 동작). ──
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: hourCount } = await supabase
    .from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('kind', 'parse').gte('created_at', hourAgo)
  if ((hourCount ?? 0) >= HOURLY_CAP) {
    return NextResponse.json({ error: 'rate_limited', message: '요청이 많아요. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }
  const premium = await isUserPremiumServer(supabase, user.id)
  if (!premium) {
    const monthStart = `${todayKST().slice(0, 8)}01T00:00:00+09:00`
    const { count: monthCount } = await supabase
      .from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('kind', 'parse').gte('created_at', monthStart)
    if ((monthCount ?? 0) >= DEFAULT_FREE_PARSE_MONTHLY) {
      return NextResponse.json(
        { error: 'free_limit_reached', message: `이번 달 무료 문서 정리(${DEFAULT_FREE_PARSE_MONTHLY}회)를 모두 썼어요. 프리미엄이면 무제한이에요.`, upsell: 'premium' },
        { status: 429 },
      )
    }
  }

  let fileUrl: string | undefined
  try {
    fileUrl = (await req.json())?.fileUrl
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!fileUrl) return NextResponse.json({ error: 'fileUrl required' }, { status: 400 })
  if (!isAllowedStorageUrl(fileUrl)) return NextResponse.json({ error: 'invalid fileUrl' }, { status: 400 })

  // 스토리지에서 파일을 받아 Upstage 로 멀티파트 전송
  let blob: Blob
  try {
    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) throw new Error('file fetch failed')
    const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream'
    const buf = Buffer.from(await fileRes.arrayBuffer())
    if (buf.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'file_too_large', message: '파일이 너무 커요.' }, { status: 413 })
    }
    blob = new Blob([buf], { type: mimeType })
  } catch {
    return NextResponse.json({ error: 'file_fetch_failed', message: '파일을 불러오지 못했어요.' }, { status: 502 })
  }

  try {
    const form = new FormData()
    form.append('document', blob, 'document')
    form.append('model', UPSTAGE_PARSE_MODEL)
    form.append('output_formats', '["html", "markdown"]')
    const res = await fetch(UPSTAGE_PARSE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(50000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[parse] upstage error', res.status, detail.slice(0, 200))
      return NextResponse.json({ error: 'parse_failed', message: '문서를 정리하지 못했어요.' }, { status: 502 })
    }
    const data = await res.json()
    // 응답 형태: content.{html,markdown,text} (버전차 방어적으로 폴백)
    const html: string = data?.content?.html ?? data?.html ?? ''
    const markdown: string = data?.content?.markdown ?? data?.markdown ?? data?.content?.text ?? ''
    if (!html && !markdown) {
      return NextResponse.json({ error: 'parse_empty', message: '문서에서 내용을 찾지 못했어요.' }, { status: 502 })
    }
    // 사용량 기록(best-effort)
    supabase.from('ai_usage').insert({ user_id: user.id, kind: 'parse' })
      .then(({ error }) => { if (error) console.error('[parse] usage insert failed', error) })
    return NextResponse.json({ ok: true, html, markdown })
  } catch (err) {
    console.error('[parse] exception', err)
    return NextResponse.json({ error: 'parse_failed', message: '문서를 정리하지 못했어요.' }, { status: 502 })
  }
}

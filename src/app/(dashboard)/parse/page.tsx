'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, validateScanFile } from '@/lib/upload'

type Phase = 'pick' | 'parsing' | 'result'

// 파싱된 HTML 을 표·레이아웃이 보이게 감싸는 최소 스타일(iframe 안에서만 적용)
const FRAME_STYLE =
  '<style>body{font-family:system-ui,sans-serif;padding:12px;font-size:14px;color:#111;line-height:1.5}' +
  'table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #d1d5db;padding:6px}' +
  'img{max-width:100%}h1,h2,h3{margin:12px 0 6px}</style>'

/**
 * 문서 정리(Upstage Document Parse / Document Digitization) — 진료기록·검사지 PDF·이미지를
 * 레이아웃 보존 구조(표 포함)로 변환해 보여준다. 결과 HTML 은 샌드박스 iframe 으로 안전 렌더.
 */
export default function ParsePage() {
  const t = useTranslations('parse')
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [html, setHtml] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const invalid = validateScanFile(file, 20)
    if (invalid) { setError(invalid); return }
    setError(null)
    setPhase('parsing')
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) throw new Error('login')
      const url = await uploadImage('pet-photos', file, user.id)
      const res = await fetch('/api/documents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: url }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.message || t('failed'))
        setPhase('pick')
        return
      }
      setHtml(json.html || '')
      setPhase('result')
    } catch {
      setError(t('failed'))
      setPhase('pick')
    }
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/more" aria-label={t('back')} className="text-gray-400 shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('title')}</h1>
          <p className="text-xs text-gray-500 leading-tight">{t('desc')}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {phase === 'pick' && (
        <div className="card text-center py-10 space-y-3">
          <div className="text-4xl" aria-hidden>📄</div>
          <p className="text-sm text-gray-600">{t('pickDesc')}</p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary px-5 py-2.5 text-sm">
            {t('pick')}
          </button>
          <p className="text-xs text-gray-400">{t('hint')}</p>
        </div>
      )}

      {phase === 'parsing' && (
        <div className="card text-center py-12 text-gray-500">
          {t('parsing')}<br /><span className="text-xs text-gray-400">{t('parsingNote')}</span>
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-3">
          <iframe
            title={t('title')}
            srcDoc={FRAME_STYLE + html}
            sandbox=""
            className="w-full h-[70vh] border border-gray-200 rounded-xl bg-white"
          />
          <button onClick={() => { setHtml(''); setPhase('pick') }} className="btn-secondary w-full py-2.5 text-sm">
            {t('again')}
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { uploadImage, validateImage } from '@/lib/upload'
import { parseOcrText, recognizeImageText } from '@/lib/ocr'
import { todayKST } from '@/lib/utils'
import type { RecordCategory } from '@/types'

const CARE_CATEGORIES: RecordCategory[] = [
  '접종', '심장사상충', '구충', '외부기생충', '건강검진',
  '미용', '양치', '발톱', '목욕', '귀청소', '기타',
]

type Phase = 'pick' | 'scanning' | 'review'

type Row = {
  include: boolean
  type: 'medical' | 'care'
  date: string
  clinic: string
  category: RecordCategory
  name: string
  next_due: string
  reason: string
  diagnosis: string
  treatment: string
  medication: string
  cost: string
}

const today = () => todayKST()

// 인식 실패 시 직접 입력용 빈 행
function emptyRow(): Row {
  return {
    include: true, type: 'medical', date: today(), clinic: '', category: '기타',
    name: '', next_due: '', reason: '', diagnosis: '', treatment: '', medication: '', cost: '',
  }
}

function toRow(r: Record<string, unknown>): Row {
  const type = r.type === 'care' ? 'care' : 'medical'
  const rawCat = String(r.category ?? '')
  const category = (CARE_CATEGORIES as string[]).includes(rawCat) ? (rawCat as RecordCategory) : '기타'
  return {
    include: true,
    type,
    date: String(r.date ?? '') || today(),
    clinic: String(r.clinic ?? ''),
    category,
    name: String(r.name ?? ''),
    next_due: String(r.next_due ?? ''),
    reason: String(r.reason ?? ''),
    diagnosis: String(r.diagnosis ?? ''),
    treatment: String(r.treatment ?? ''),
    medication: String(r.medication ?? ''),
    cost: r.cost ? String(r.cost) : '',
  }
}

/**
 * 영수증·세부내역서·진료이력서·접종증명서 사진을 스캔해
 * 여러 건의 진료/관리 기록을 한 번에 검토·저장한다. (1 사진 → N 기록)
 */
export function RecordsScanModal({
  petId, onClose,
}: {
  petId: string
  onClose: () => void
}) {
  const t = useTranslations('scan')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [rows, setRows] = useState<Row[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)
  const [rawOpen, setRawOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const scan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택 허용
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) { setError(invalid); return }
    setPhase('scanning'); setError(null); setNotice(null); setRawText(null)
    // 인식 실패해도 막히지 않도록: 빈 입력 행으로 넘어가 직접 입력
    const fallbackToManual = (msg: string) => {
      setError(msg)
      setRows([emptyRow()])
      setPhase('review')
    }
    // 2차: 브라우저 무료 OCR(Tesseract) — 날짜·금액만 채우고 원문 제공
    const localFallback = async () => {
      setNotice(t('tesseractRunning'))
      try {
        const text = await recognizeImageText(file)
        if (!text) { fallbackToManual(t('fallbackManual')); setNotice(null); return }
        const { date, cost } = parseOcrText(text)
        setRows([{ ...emptyRow(), date: date || today(), cost: cost ? String(cost) : '' }])
        setRawText(text.slice(0, 2000))
        setNotice(t('tesseractNotice'))
        setPhase('review')
      } catch {
        setNotice(null)
        fallbackToManual(t('fallbackManual'))
      }
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      const url = await uploadImage('pet-photos', file, user.id)
      setPhotoUrl(url)
      const res = await fetch('/api/medical/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      })
      const json = await res.json().catch(() => ({}))
      // 시간당 AI 인식 한도 초과(429)는 조용히 무료 인식으로만 넘어가지 않고 명확히 안내한다.
      if (res.status === 429) {
        setError(json.message || t('ocrLimitReached'))
        await localFallback()
        return
      }
      const parsed = (res.ok ? (json.records ?? []) : []) as Record<string, unknown>[]
      // LLM 성공 → 그대로 사용. 실패/빈결과 → 무료 OCR 폴백
      if (parsed.length > 0) {
        setRows(parsed.map(toRow))
        // 남은 AI 인식 횟수가 적으면(≤5) 미리 알려 준다.
        if (typeof json.remaining === 'number' && json.remaining <= 5) {
          setNotice(t('ocrRemainingLow', { n: json.remaining }))
        }
        setPhase('review')
      } else {
        await localFallback()
      }
    } catch {
      await localFallback()
    }
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const save = async () => {
    if (!rows.some(r => r.include)) { setError(t('errSelectRecords')); return }
    setSaving(true); setError(null)

    // 통합 records 테이블에 저장 (진료면 record_medical 상세도 함께).
    // 이미 저장된 행은 재시도 시 중복 삽입되지 않도록 성공 인덱스를 추적한다.
    const saved = new Set<number>()
    let partial = false
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.include) continue
      const isMed = r.type === 'medical'
      const title = (isMed ? (r.diagnosis || r.name || r.reason) : (r.name || r.category)).trim()
      const common = {
        pet_id: petId,
        category: isMed ? '진료' : r.category,
        title: title || (isMed ? '진료' : r.category),
        event_on: r.date || today(),
        place_name: r.clinic.trim() || null,
        cost: r.cost ? parseInt(r.cost, 10) : null,
        next_due_on: r.next_due || null,
        photo_url: photoUrl, // 원본 영수증/이력서 사진을 함께 보관
        photo_urls: photoUrl ? [photoUrl] : null,
      }
      const { data, error: e } = await supabase.from('records').insert(common).select('id').single()
      if (e || !data) { partial = true; continue }
      // records 는 저장됨 → 재시도 중복 방지를 위해 성공으로 표시(상세 실패는 경고만).
      saved.add(i)
      if (isMed) {
        const { error: me } = await supabase.from('record_medical').insert({
          record_id: data.id,
          reason: r.reason.trim() || null,
          treatment: r.treatment.trim() || null,
          medication: r.medication.trim() || null,
        })
        if (me) partial = true
      }
    }
    setSaving(false)

    if (saved.size > 0) {
      // QuickLogBar 와 동일한 전체 무효화 세트 — 홈 타임라인·피드·오늘 기록도 즉시 갱신.
      qc.invalidateQueries({ queryKey: ['records', petId] })
      qc.invalidateQueries({ queryKey: ['care-schedule'] })
      qc.invalidateQueries({ queryKey: ['today-log', petId] })
      qc.invalidateQueries({ queryKey: ['today-timeline', petId] })
      qc.invalidateQueries({ queryKey: ['today-timeline', null] })
      qc.invalidateQueries({ queryKey: ['record-feed', petId] })
      qc.invalidateQueries({ queryKey: ['record-feed', null] })
      // 홈 생활 패턴·주간 리포트(활동·성장 레벨)·월간 회고도 기록을 집계원으로 쓰므로 함께 무효화
      // (QuickLogBar·RecordForm 과 동일 세트로 맞춰 스캔 저장 직후에도 옛값이 남지 않게 한다).
      qc.invalidateQueries({ queryKey: ['life-pattern', petId] })
      qc.invalidateQueries({ queryKey: ['weekly-report', petId] })
      qc.invalidateQueries({ queryKey: ['monthly-recap', petId] })
      // 스캔 기록은 진료비 등 비용을 포함할 수 있으므로 비용 통계도 갱신한다.
      qc.invalidateQueries({ queryKey: ['cost-records'] })
    }

    if (partial) {
      // 성공한 행은 목록에서 제거해, 다시 저장을 눌러도 중복 삽입되지 않게 한다.
      setRows(rs => rs.filter((_, i) => !saved.has(i)))
      setError(t('errSavePartial'))
      return
    }
    onClose()
  }

  const includedCount = rows.filter(r => r.include).length

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{t('title')}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {phase === 'pick' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">🧾</div>
              <p className="text-sm text-gray-600">{t.rich('pickDesc', { br: () => <br /> })}</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => cameraRef.current?.click()} className="btn-primary px-5 py-2.5 text-sm">
                  {t('pickCamera')}
                </button>
                <button onClick={() => galleryRef.current?.click()} className="btn-secondary px-5 py-2.5 text-sm">
                  {t('pickGallery')}
                </button>
              </div>
              <p className="text-xs text-gray-400">{t('aiNotice')}</p>
            </div>
          )}

          {phase === 'scanning' && (
            <div className="text-center py-12 text-gray-500">{t('scanning')}<br /><span className="text-xs text-gray-400">{t('scanningNote')}</span></div>
          )}

          {phase === 'review' && (
            <>
              {notice && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{notice}</p>}
              {rawText && (
                <div className="rounded-lg border border-gray-200">
                  <button type="button" onClick={() => setRawOpen(o => !o)}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-gray-600">
                    {rawOpen ? '▾ ' : '▸ '}{t('rawTextLabel')}
                  </button>
                  {rawOpen && (
                    <pre className="px-3 pb-2 text-xs text-gray-500 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{rawText}</pre>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">{t.rich('reviewSummary', { count: rows.length, b: (chunks) => <b>{chunks}</b> })}</p>
              {rows.map((r, i) => (
                <div key={i} className={`rounded-xl border p-3 space-y-2 ${r.include ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={r.include} onChange={e => update(i, { include: e.target.checked })} className="w-4 h-4 accent-primary-500" />
                    <select value={r.type} onChange={e => update(i, { type: e.target.value as Row['type'] })}
                      className="text-xs font-semibold border border-gray-200 rounded-md px-1.5 py-1">
                      <option value="medical">{t('typeMedical')}</option>
                      <option value="care">{t('typeCare')}</option>
                    </select>
                    <input type="date" value={r.date} onChange={e => update(i, { date: e.target.value })}
                      className="text-xs border border-gray-200 rounded-md px-1.5 py-1 flex-1" />
                  </div>

                  {r.type === 'care' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <select value={r.category} onChange={e => update(i, { category: e.target.value as RecordCategory })}
                        className="input text-sm py-1.5">
                        {CARE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="input text-sm py-1.5" placeholder={t('namePlaceholder')} value={r.name}
                        onChange={e => update(i, { name: e.target.value })} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input className="input text-sm py-1.5" placeholder={t('diagnosisPlaceholder')} value={r.diagnosis || r.name}
                        onChange={e => update(i, { diagnosis: e.target.value, name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input text-sm py-1.5" placeholder={t('treatmentPlaceholder')} value={r.treatment}
                          onChange={e => update(i, { treatment: e.target.value })} />
                        <input className="input text-sm py-1.5" type="number" inputMode="numeric" placeholder={t('costPlaceholder')} value={r.cost}
                          onChange={e => update(i, { cost: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRows(rs => [...rs, emptyRow()])}
                className="w-full text-sm text-primary-600 font-medium py-2 border border-dashed border-gray-200 rounded-xl hover:bg-gray-50"
              >
                {t('addRow')}
              </button>
            </>
          )}
        </div>

        {phase === 'review' && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button onClick={save} disabled={saving || includedCount === 0} className="btn-primary w-full py-2.5 text-sm">
              {saving ? tc('saving') : t('saveCount', { count: includedCount })}
            </button>
          </div>
        )}

        {/* 촬영(카메라) / 갤러리(보관함) 분리 */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scan} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={scan} />
      </div>
    </div>
  )
}

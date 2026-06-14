'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { uploadImage, validateImage } from '@/lib/upload'
import type { CareCategory } from '@/types'

const CARE_CATEGORIES: CareCategory[] = [
  '접종', '심장사상충', '구충', '외부기생충', '건강검진',
  '미용', '양치', '발톱', '목욕', '귀청소', '기타',
]

type Phase = 'pick' | 'scanning' | 'review'

type Row = {
  include: boolean
  type: 'medical' | 'care'
  date: string
  clinic: string
  category: CareCategory
  name: string
  next_due: string
  reason: string
  diagnosis: string
  treatment: string
  medication: string
  cost: string
}

const today = () => new Date().toISOString().slice(0, 10)

function toRow(r: Record<string, unknown>): Row {
  const type = r.type === 'care' ? 'care' : 'medical'
  const rawCat = String(r.category ?? '')
  const category = (CARE_CATEGORIES as string[]).includes(rawCat) ? (rawCat as CareCategory) : '기타'
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
  const supabase = createClient()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [rows, setRows] = useState<Row[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const scan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) { setError(invalid); return }
    setPhase('scanning'); setError(null)
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
      if (!res.ok) { setError(json?.message || t('errRecognizeFailed')); setPhase('pick'); return }
      const parsed = (json.records ?? []) as Record<string, unknown>[]
      if (parsed.length === 0) { setError(t('errNoRecords')); setPhase('pick'); return }
      setRows(parsed.map(toRow))
      setPhase('review')
    } catch {
      setError(t('errScanFailed'))
      setPhase('pick')
    }
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const save = async () => {
    const picked = rows.filter(r => r.include)
    if (picked.length === 0) { setError(t('errSelectRecords')); return }
    setSaving(true); setError(null)

    const careRows = picked.filter(r => r.type === 'care').map(r => ({
      pet_id: petId,
      category: r.category,
      vaccine_name: r.name.trim() || r.category,
      vaccinated_on: r.date || today(),
      next_due_on: r.next_due || null,
      clinic: r.clinic.trim() || null,
    }))
    const medRows = picked.filter(r => r.type === 'medical').map(r => ({
      pet_id: petId,
      visited_on: r.date || today(),
      clinic: r.clinic.trim() || null,
      reason: r.reason.trim() || null,
      diagnosis: r.diagnosis.trim() || null,
      treatment: r.treatment.trim() || null,
      medication: r.medication.trim() || null,
      cost: r.cost ? parseInt(r.cost, 10) : null,
      next_visit_on: r.next_due || null,
      // 원본 영수증/이력서 사진을 진료 기록에 함께 보관
      photo_url: photoUrl,
    }))

    let failed = false
    if (careRows.length) {
      const { error: e } = await supabase.from('vaccination_records').insert(careRows)
      if (e) failed = true
    }
    if (medRows.length) {
      const { error: e } = await supabase.from('medical_records').insert(medRows)
      if (e) failed = true
    }
    setSaving(false)
    if (failed) { setError(t('errSavePartial')); return }

    qc.invalidateQueries({ queryKey: ['care', petId] })
    qc.invalidateQueries({ queryKey: ['medical', petId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
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
              <button onClick={() => inputRef.current?.click()} className="btn-primary px-5 py-2.5 text-sm">
                {t('pickButton')}
              </button>
              <p className="text-xs text-gray-400">{t('aiNotice')}</p>
            </div>
          )}

          {phase === 'scanning' && (
            <div className="text-center py-12 text-gray-500">{t('scanning')}<br /><span className="text-xs text-gray-400">{t('scanningNote')}</span></div>
          )}

          {phase === 'review' && (
            <>
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
                      <select value={r.category} onChange={e => update(i, { category: e.target.value as CareCategory })}
                        className="input text-sm py-1.5">
                        {CARE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input className="input text-sm py-1.5" placeholder={t('namePlaceholder')} value={r.name}
                        onChange={e => update(i, { name: e.target.value })} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input className="input text-sm py-1.5" placeholder="진단/사유" value={r.diagnosis || r.name}
                        onChange={e => update(i, { diagnosis: e.target.value, name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input text-sm py-1.5" placeholder="처치/처방" value={r.treatment}
                          onChange={e => update(i, { treatment: e.target.value })} />
                        <input className="input text-sm py-1.5" type="number" inputMode="numeric" placeholder="비용(원)" value={r.cost}
                          onChange={e => update(i, { cost: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {phase === 'review' && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button onClick={save} disabled={saving || includedCount === 0} className="btn-primary w-full py-2.5 text-sm">
              {saving ? '저장 중...' : `${includedCount}건 저장`}
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scan} />
      </div>
    </div>
  )
}

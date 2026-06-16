'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { addDays, careCategoryIcon, careRecommendedCycleDays, ddayBadge, ddayToneClass } from '@/lib/utils'
import type { CareCategory, CareRecord } from '@/types'

const CATEGORIES: CareCategory[] = [
  '접종', '심장사상충', '구충', '외부기생충', '건강검진',
  '미용', '양치', '발톱', '목욕', '귀청소', '기타',
]

// 카테고리별 항목명 입력 힌트
const NAME_PLACEHOLDER: Record<CareCategory, string> = {
  '접종': '예: 종합백신 DHPPL',
  '심장사상충': '예: 하트가드, 애드보킷',
  '구충': '예: 드론탈, 파나쿠어',
  '외부기생충': '예: 넥스가드, 프론트라인',
  '건강검진': '예: 혈액검사, 엑스레이',
  '미용': '예: 전체미용, 위생미용',
  '양치': '예: 양치, 치석 관리',
  '발톱': '예: 발톱 깎기',
  '목욕': '예: 목욕',
  '귀청소': '예: 귀 세정',
  '기타': '항목명',
}

export function CareSection({ petId, defaultOpen = false }: { petId: string; defaultOpen?: boolean }) {
  const t = useTranslations('care')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(defaultOpen)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filter, setFilter] = useState<CareCategory | '전체'>('전체')
  // 다음 예정일을 사용자가 직접 건드렸는지 (true면 자동 제안 중단)
  const [dueTouched, setDueTouched] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    category: '접종' as CareCategory,
    vaccine_name: '',
    vaccinated_on: today,
    next_due_on: addDays(today, careRecommendedCycleDays('접종') ?? 0),
    clinic: '',
  })

  // 카테고리·시행일 변경 시 다음 예정일을 권장 주기로 자동 제안(사용자가 안 건드린 경우)
  const suggestDue = (category: CareCategory, vaccinatedOn: string) => {
    const days = careRecommendedCycleDays(category)
    return days ? addDays(vaccinatedOn, days) : ''
  }
  const setCategory = (category: CareCategory) =>
    setForm(f => ({ ...f, category, next_due_on: dueTouched ? f.next_due_on : suggestDue(category, f.vaccinated_on) }))
  const setVaccinatedOn = (vaccinated_on: string) =>
    setForm(f => ({ ...f, vaccinated_on, next_due_on: dueTouched ? f.next_due_on : suggestDue(f.category, vaccinated_on) }))

  const { data: records = [] } = useQuery({
    queryKey: ['care', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vaccination_records')
        .select('*')
        .eq('pet_id', petId)
        .order('vaccinated_on', { ascending: false })
      return (data ?? []) as CareRecord[]
    },
  })

  const resetForm = () => {
    const now = new Date().toISOString().slice(0, 10)
    setForm({ category: '접종', vaccine_name: '', vaccinated_on: now, next_due_on: suggestDue('접종', now), clinic: '' })
    setDueTouched(false)
    setEditingId(null)
    setError(null)
  }

  // 추가 폼 토글 (닫을 때 편집 상태·입력값 초기화)
  const toggleAdding = () => {
    setAdding(a => {
      if (a) resetForm()
      return !a
    })
  }

  // 기존 기록을 편집 모드로 열기 (폼에 값 채움)
  const startEdit = (r: CareRecord) => {
    setEditingId(r.id)
    setDueTouched(true) // 기존 값 보존 (카테고리/날짜 바꿔도 자동 덮어쓰지 않음)
    setForm({
      category: r.category,
      vaccine_name: r.vaccine_name,
      vaccinated_on: r.vaccinated_on,
      next_due_on: r.next_due_on ?? '',
      clinic: r.clinic ?? '',
    })
    setError(null)
    setAdding(true)
  }

  const submit = async () => {
    if (!form.vaccine_name.trim()) { setError(t('errNameRequired')); return }
    if (form.next_due_on && form.next_due_on < form.vaccinated_on) {
      setError(t('errDueAfter')); return
    }
    setSaving(true); setError(null)
    const payload = {
      pet_id: petId,
      category: form.category,
      vaccine_name: form.vaccine_name.trim(),
      vaccinated_on: form.vaccinated_on,
      next_due_on: form.next_due_on || null,
      clinic: form.clinic.trim() || null,
    }
    const { error: saveErr } = editingId
      ? await supabase.from('vaccination_records').update(payload).eq('id', editingId)
      : await supabase.from('vaccination_records').insert(payload)
    setSaving(false)
    if (saveErr) { setError(t('errSaveFailed')); return }
    resetForm()
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['care', petId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  const remove = async (id: string) => {
    await supabase.from('vaccination_records').delete().eq('id', id)
    setConfirmDeleteId(null)
    if (editingId === id) { resetForm(); setAdding(false) }
    qc.invalidateQueries({ queryKey: ['care', petId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('subtitle')}</p>
        </div>
        <button
          onClick={toggleAdding}
          className="text-sm text-primary-600 font-semibold"
        >
          {adding ? tc('cancel') : t('addRecord')}
        </button>
      </div>

      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          {/* 카테고리 선택 */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.category === c
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {careCategoryIcon(c)} {c}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder={NAME_PLACEHOLDER[form.category]}
            value={form.vaccine_name}
            onChange={e => setForm(f => ({ ...f, vaccine_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">{t('performedOn')}</label>
              <input className="input" type="date" max={today}
                value={form.vaccinated_on}
                onChange={e => setVaccinatedOn(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">
                {t('nextDue')}
                {!dueTouched && form.next_due_on && (
                  <span className="text-primary-500 ml-1">{t('autoCycle')}</span>
                )}
              </label>
              <input className="input" type="date"
                value={form.next_due_on}
                onChange={e => { setDueTouched(true); setForm(f => ({ ...f, next_due_on: e.target.value })) }} />
            </div>
          </div>
          <input
            className="input"
            placeholder={t('clinicPlaceholder')}
            value={form.clinic}
            onChange={e => setForm(f => ({ ...f, clinic: e.target.value }))}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={submit} disabled={saving} className="btn-primary w-full py-2 text-sm">
            {saving ? tc('saving') : editingId ? tc('edit') : tc('save')}
          </button>
        </div>
      )}

      {/* 카테고리 필터 (기록이 있을 때만) */}
      {records.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(['전체', ...CATEGORIES.filter(c => records.some(r => r.category === c))] as const).map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === c
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {c === '전체' ? t('filterAll') : `${careCategoryIcon(c)} ${c}`}
            </button>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {records.filter(r => filter === '전체' || r.category === filter).map(r => {
            const badge = r.next_due_on ? ddayBadge(r.next_due_on) : null
            return (
              <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                    {careCategoryIcon(r.category)} {r.category}
                  </span>
                  <span className="font-semibold text-sm text-gray-900 truncate">{r.vaccine_name}</span>
                  {confirmDeleteId === r.id ? (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{t('deleteConfirm')}</span>
                      <button onClick={() => remove(r.id)} className="text-xs text-red-500 font-semibold">{tc('delete')}</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400">{tc('cancel')}</button>
                    </div>
                  ) : (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(r)}
                        className="text-xs text-gray-300 hover:text-primary-600"
                      >
                        {tc('edit')}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        className="text-xs text-gray-300 hover:text-red-500"
                        aria-label={t('deleteAria')}
                      >
                        {tc('delete')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t('performedAt', { date: r.vaccinated_on })}
                  {r.clinic && ` · ${r.clinic}`}
                </div>
                {r.next_due_on && badge && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ddayToneClass(badge.tone)}`}>
                      {badge.text}
                    </span>
                    <span className="text-xs text-gray-400">{t('nextScheduled', { date: r.next_due_on })}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

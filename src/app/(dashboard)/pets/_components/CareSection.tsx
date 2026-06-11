'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { addMonths, careCategoryIcon, careDefaultIntervalMonths, ddayBadge, ddayToneClass } from '@/lib/utils'
import type { CareCategory, CareRecord } from '@/types'

const CATEGORIES: CareCategory[] = ['접종', '심장사상충', '구충', '외부기생충', '건강검진', '기타']

// 카테고리별 항목명 입력 힌트
const NAME_PLACEHOLDER: Record<CareCategory, string> = {
  '접종': '예: 종합백신 DHPPL',
  '심장사상충': '예: 하트가드, 애드보킷',
  '구충': '예: 드론탈, 파나쿠어',
  '외부기생충': '예: 넥스가드, 프론트라인',
  '건강검진': '예: 혈액검사, 엑스레이',
  '기타': '항목명',
}

export function CareSection({ petId, defaultOpen = false }: { petId: string; defaultOpen?: boolean }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(defaultOpen)
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
    next_due_on: addMonths(today, careDefaultIntervalMonths('접종') ?? 0),
    clinic: '',
  })

  // 카테고리·시행일 변경 시 다음 예정일을 권장 주기로 자동 제안(사용자가 안 건드린 경우)
  const suggestDue = (category: CareCategory, vaccinatedOn: string) => {
    const months = careDefaultIntervalMonths(category)
    return months ? addMonths(vaccinatedOn, months) : ''
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

  const add = async () => {
    if (!form.vaccine_name.trim()) { setError('항목명을 입력해주세요'); return }
    if (form.next_due_on && form.next_due_on < form.vaccinated_on) {
      setError('다음 예정일은 시행일 이후여야 해요'); return
    }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('vaccination_records').insert({
      pet_id: petId,
      category: form.category,
      vaccine_name: form.vaccine_name.trim(),
      vaccinated_on: form.vaccinated_on,
      next_due_on: form.next_due_on || null,
      clinic: form.clinic.trim() || null,
    })
    setSaving(false)
    if (insErr) { setError('저장에 실패했어요'); return }
    const now = new Date().toISOString().slice(0, 10)
    setForm({ category: '접종', vaccine_name: '', vaccinated_on: now, next_due_on: suggestDue('접종', now), clinic: '' })
    setDueTouched(false)
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['care', petId] })
  }

  const remove = async (id: string) => {
    await supabase.from('vaccination_records').delete().eq('id', id)
    setConfirmDeleteId(null)
    qc.invalidateQueries({ queryKey: ['care', petId] })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">건강 관리 기록</h2>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-sm text-primary-600 font-semibold"
        >
          {adding ? '취소' : '+ 기록'}
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
              <label className="text-xs text-gray-500 block mb-0.5">시행일</label>
              <input className="input" type="date" max={today}
                value={form.vaccinated_on}
                onChange={e => setVaccinatedOn(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">
                다음 예정일
                {!dueTouched && form.next_due_on && (
                  <span className="text-primary-500 ml-1">· 권장 주기 자동</span>
                )}
              </label>
              <input className="input" type="date"
                value={form.next_due_on}
                onChange={e => { setDueTouched(true); setForm(f => ({ ...f, next_due_on: e.target.value })) }} />
            </div>
          </div>
          <input
            className="input"
            placeholder="병원 (선택)"
            value={form.clinic}
            onChange={e => setForm(f => ({ ...f, clinic: e.target.value }))}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={add} disabled={saving} className="btn-primary w-full py-2 text-sm">
            {saving ? '저장 중...' : '저장'}
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
              {c === '전체' ? '전체' : `${careCategoryIcon(c)} ${c}`}
            </button>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">아직 기록이 없어요</p>
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
                      <span className="text-xs text-gray-500">삭제할까요?</span>
                      <button onClick={() => remove(r.id)} className="text-xs text-red-500 font-semibold">삭제</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400">취소</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="ml-auto text-xs text-gray-300 hover:text-red-500 shrink-0"
                      aria-label="기록 삭제"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  시행 {r.vaccinated_on}
                  {r.clinic && ` · ${r.clinic}`}
                </div>
                {r.next_due_on && badge && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ddayToneClass(badge.tone)}`}>
                      {badge.text}
                    </span>
                    <span className="text-xs text-gray-400">다음 예정 {r.next_due_on}</span>
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

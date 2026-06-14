'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useMyPets } from '@/hooks/useMyPets'
import { addDays, careCategoryIcon, careRecommendedCycleDays } from '@/lib/utils'
import type { CareCategory } from '@/types'

const CATEGORIES: CareCategory[] = [
  '접종', '심장사상충', '구충', '외부기생충', '건강검진',
  '미용', '양치', '발톱', '목욕', '귀청소', '기타',
]

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

/**
 * 건강 일정 화면에서 바로 건강 관리 기록을 추가하는 폼.
 * (아이 상세 → 건강 관리 기록과 동일한 vaccination_records 에 저장)
 * 아이를 직접 선택할 수 있다는 점만 다르다.
 */
export function ScheduleAddForm({
  defaultPetId,
  onClose,
}: {
  defaultPetId?: string | null
  onClose: () => void
}) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: pets = [] } = useMyPets()
  const today = new Date().toISOString().slice(0, 10)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dueTouched, setDueTouched] = useState(false)
  const [form, setForm] = useState({
    pet_id: defaultPetId || '',
    category: '접종' as CareCategory,
    vaccine_name: '',
    vaccinated_on: today,
    next_due_on: addDays(today, careRecommendedCycleDays('접종') ?? 0),
    clinic: '',
  })

  const suggestDue = (category: CareCategory, vaccinatedOn: string) => {
    const days = careRecommendedCycleDays(category)
    return days ? addDays(vaccinatedOn, days) : ''
  }
  const setCategory = (category: CareCategory) =>
    setForm(f => ({ ...f, category, next_due_on: dueTouched ? f.next_due_on : suggestDue(category, f.vaccinated_on) }))
  const setVaccinatedOn = (vaccinated_on: string) =>
    setForm(f => ({ ...f, vaccinated_on, next_due_on: dueTouched ? f.next_due_on : suggestDue(f.category, vaccinated_on) }))

  // 기본 선택 아이가 없으면 첫 번째 아이로 채움
  const petId = form.pet_id || pets[0]?.id || ''

  const add = async () => {
    if (!petId) { setError('등록된 아이가 없어요'); return }
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
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    qc.invalidateQueries({ queryKey: ['care', petId] })
    onClose()
  }

  return (
    <div className="card space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">일정 추가</h2>
        <button onClick={onClose} className="text-sm text-gray-400">취소</button>
      </div>

      {/* 아이 선택 */}
      {pets.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {pets.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setForm(f => ({ ...f, pet_id: p.id }))}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                petId === p.id
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {p.species === 'cat' ? '🐱' : '🐶'} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* 카테고리 */}
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
              <span className="text-primary-500 ml-1">· 자동</span>
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
  )
}

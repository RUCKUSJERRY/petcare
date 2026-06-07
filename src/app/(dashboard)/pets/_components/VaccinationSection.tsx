'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { VaccinationRecord } from '@/types'

export function VaccinationSection({ petId }: { petId: string }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    vaccine_name: '',
    vaccinated_on: new Date().toISOString().slice(0, 10),
    next_due_on: '',
    clinic: '',
  })

  const { data: records = [] } = useQuery({
    queryKey: ['vaccinations', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vaccination_records')
        .select('*')
        .eq('pet_id', petId)
        .order('vaccinated_on', { ascending: false })
      return (data ?? []) as VaccinationRecord[]
    },
  })

  const add = async () => {
    if (!form.vaccine_name.trim()) { setError('백신 이름을 입력해주세요'); return }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('vaccination_records').insert({
      pet_id: petId,
      vaccine_name: form.vaccine_name.trim(),
      vaccinated_on: form.vaccinated_on,
      next_due_on: form.next_due_on || null,
      clinic: form.clinic.trim() || null,
    })
    setSaving(false)
    if (insErr) { setError('저장에 실패했어요'); return }
    setForm({ vaccine_name: '', vaccinated_on: new Date().toISOString().slice(0, 10), next_due_on: '', clinic: '' })
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['vaccinations', petId] })
  }

  const remove = async (id: string) => {
    await supabase.from('vaccination_records').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['vaccinations', petId] })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">접종 기록</h2>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-sm text-primary-600 font-semibold"
        >
          {adding ? '취소' : '+ 기록'}
        </button>
      </div>

      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <input
            className="input"
            placeholder="백신 이름 (예: 종합백신 DHPPL)"
            value={form.vaccine_name}
            onChange={e => setForm(f => ({ ...f, vaccine_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">접종일</label>
              <input className="input" type="date" max={today}
                value={form.vaccinated_on}
                onChange={e => setForm(f => ({ ...f, vaccinated_on: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">다음 예정일</label>
              <input className="input" type="date"
                value={form.next_due_on}
                onChange={e => setForm(f => ({ ...f, next_due_on: e.target.value }))} />
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

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">아직 접종 기록이 없어요</p>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const dueSoon = r.next_due_on && r.next_due_on >= today
            const overdue = r.next_due_on && r.next_due_on < today
            return (
              <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{r.vaccine_name}</span>
                  <button
                    onClick={() => remove(r.id)}
                    className="ml-auto text-xs text-gray-300 hover:text-red-500"
                  >
                    삭제
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  접종 {r.vaccinated_on}
                  {r.clinic && ` · ${r.clinic}`}
                </div>
                {r.next_due_on && (
                  <div className={`text-xs mt-1 font-medium ${overdue ? 'text-red-500' : dueSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                    다음 예정 {r.next_due_on}{overdue ? ' (지남)' : ''}
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

'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ddayBadge, ddayToneClass } from '@/lib/utils'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { deleteImageByUrl } from '@/lib/upload'
import type { MedicalRecord } from '@/types'

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

const EMPTY = {
  visited_on: '',
  clinic: '',
  reason: '',
  diagnosis: '',
  treatment: '',
  medication: '',
  cost: '',
  next_visit_on: '',
  note: '',
}

export function MedicalSection({ petId, defaultOpen = false }: { petId: string; defaultOpen?: boolean }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [adding, setAdding] = useState(defaultOpen)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY, visited_on: today })

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: records = [] } = useQuery({
    queryKey: ['medical', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('pet_id', petId)
        .order('visited_on', { ascending: false })
      return (data ?? []) as MedicalRecord[]
    },
  })

  const resetForm = () => {
    setForm({ ...EMPTY, visited_on: today })
    setPhotoUrl(null)
    setPhotoError(null)
  }

  const add = async () => {
    if (!form.reason.trim() && !form.diagnosis.trim()) {
      setError('증상(내원 사유)이나 진단 중 하나는 입력해주세요')
      return
    }
    if (form.next_visit_on && form.next_visit_on < form.visited_on) {
      setError('다음 내원 예정일은 진료일 이후여야 해요')
      return
    }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('medical_records').insert({
      pet_id: petId,
      visited_on: form.visited_on,
      clinic: form.clinic.trim() || null,
      reason: form.reason.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      treatment: form.treatment.trim() || null,
      medication: form.medication.trim() || null,
      cost: form.cost ? parseInt(form.cost, 10) : null,
      next_visit_on: form.next_visit_on || null,
      note: form.note.trim() || null,
      photo_url: photoUrl,
    })
    setSaving(false)
    if (insErr) {
      setError('저장에 실패했어요')
      // 저장 실패 시 방금 올린 사진은 고아가 되므로 정리
      if (photoUrl) deleteImageByUrl(photoUrl)
      return
    }
    resetForm()
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['medical', petId] })
  }

  const remove = async (r: MedicalRecord) => {
    await supabase.from('medical_records').delete().eq('id', r.id)
    if (r.photo_url) deleteImageByUrl(r.photo_url)
    setConfirmDeleteId(null)
    qc.invalidateQueries({ queryKey: ['medical', petId] })
  }

  const toggleAdding = () => {
    setAdding(a => {
      const next = !a
      // 닫을 때 미저장 사진 정리
      if (!next && photoUrl) { deleteImageByUrl(photoUrl); setPhotoUrl(null) }
      if (!next) { setError(null) }
      return next
    })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">진료 기록</h2>
          <p className="text-xs text-gray-400 mt-0.5">병원 방문·진단·처치 이력 (이사·병원 변경 시 그대로 조회)</p>
        </div>
        <button onClick={toggleAdding} className="text-sm text-primary-600 font-semibold shrink-0">
          {adding ? '취소' : '+ 기록'}
        </button>
      </div>

      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">진료일</label>
              <input className="input" type="date" max={today}
                value={form.visited_on} onChange={e => set('visited_on', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">병원</label>
              <input className="input" placeholder="병원명 (선택)"
                value={form.clinic} onChange={e => set('clinic', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">증상 · 내원 사유</label>
            <input className="input" placeholder="예: 구토, 절뚝거림, 정기검진"
              value={form.reason} onChange={e => set('reason', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">진단</label>
            <input className="input" placeholder="예: 외이염, 슬개골 탈구 1기"
              value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">처치 · 치료</label>
            <textarea className="input min-h-[60px]" placeholder="예: 귀 세정, 소염 주사"
              value={form.treatment} onChange={e => set('treatment', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">처방약</label>
              <input className="input" placeholder="예: 항생제 7일분"
                value={form.medication} onChange={e => set('medication', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">비용 (원)</label>
              <input className="input" type="number" inputMode="numeric" min={0} placeholder="예: 45000"
                value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">다음 내원 예정일 (선택)</label>
            <input className="input" type="date"
              value={form.next_visit_on} onChange={e => set('next_visit_on', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">처방전 · 영수증 사진 (선택)</label>
            <ImagePicker
              bucket="pet-photos"
              value={photoUrl}
              onUploaded={url => { setPhotoUrl(url); setPhotoError(null) }}
              onError={setPhotoError}
            />
            {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={add} disabled={saving} className="btn-primary w-full py-2 text-sm">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">아직 진료 기록이 없어요</p>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const badge = r.next_visit_on ? ddayBadge(r.next_visit_on) : null
            return (
              <div key={r.id} className="border border-gray-100 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                    🏥 {r.visited_on}
                  </span>
                  {r.clinic && <span className="text-xs text-gray-500 truncate">{r.clinic}</span>}
                  {confirmDeleteId === r.id ? (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">삭제할까요?</span>
                      <button onClick={() => remove(r)} className="text-xs text-red-500 font-semibold">삭제</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(r.id)}
                      className="ml-auto text-xs text-gray-300 hover:text-red-500 shrink-0" aria-label="기록 삭제">
                      삭제
                    </button>
                  )}
                </div>

                {(r.reason || r.diagnosis) && (
                  <p className="text-sm font-semibold text-gray-900">
                    {r.diagnosis || r.reason}
                    {r.diagnosis && r.reason && <span className="font-normal text-gray-500"> · {r.reason}</span>}
                  </p>
                )}
                {r.treatment && <p className="text-sm text-gray-600 whitespace-pre-wrap">처치: {r.treatment}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  {r.medication && <span>💊 {r.medication}</span>}
                  {r.cost != null && <span>💳 {won(r.cost)}</span>}
                </div>
                {r.note && <p className="text-xs text-gray-400 whitespace-pre-wrap">{r.note}</p>}

                {r.photo_url && (
                  <ImageLightbox src={r.photo_url} alt="처방전/영수증"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
                )}

                {r.next_visit_on && badge && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ddayToneClass(badge.tone)}`}>
                      {badge.text}
                    </span>
                    <span className="text-xs text-gray-400">다음 내원 {r.next_visit_on}</span>
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

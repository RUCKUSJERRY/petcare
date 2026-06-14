'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMyPets } from '@/hooks/useMyPets'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { deleteImageByUrl } from '@/lib/upload'

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

/**
 * 일정(기록) 화면에서 바로 진료 기록을 추가하는 폼.
 * (아이 상세 → 진료 기록과 동일한 medical_records 에 저장)
 * 아이를 직접 선택할 수 있다는 점만 다르다.
 */
export function ScheduleMedicalAddForm({
  defaultPetId,
  onClose,
}: {
  defaultPetId?: string | null
  onClose: () => void
}) {
  const supabase = createClient()
  const t = useTranslations('medical')
  const ts = useTranslations('schedule')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const { data: pets = [] } = useMyPets()
  const today = new Date().toISOString().slice(0, 10)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [petId, setPetId] = useState(defaultPetId || '')
  const [form, setForm] = useState({ ...EMPTY, visited_on: today })

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // 기본 선택 아이가 없으면 첫 번째 아이로 채움
  const effectivePetId = petId || pets[0]?.id || ''

  const add = async () => {
    if (!effectivePetId) { setError(ts('errNoPet')); return }
    if (!form.reason.trim() && !form.diagnosis.trim()) {
      setError(t('errReasonOrDiagnosis'))
      return
    }
    if (form.next_visit_on && form.next_visit_on < form.visited_on) {
      setError(t('errNextVisitAfter'))
      return
    }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('medical_records').insert({
      pet_id: effectivePetId,
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
      setError(t('errSaveFailed'))
      // 저장 실패 시 방금 올린 사진은 고아가 되므로 정리
      if (photoUrl) deleteImageByUrl(photoUrl)
      return
    }
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    qc.invalidateQueries({ queryKey: ['medical', effectivePetId] })
    onClose()
  }

  return (
    <div className="card space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{t('title')}</h2>
        <button onClick={onClose} className="text-sm text-gray-400">{tc('cancel')}</button>
      </div>

      {/* 아이 선택 */}
      {pets.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {pets.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPetId(p.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                effectivePetId === p.id
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {p.species === 'cat' ? '🐱' : '🐶'} {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">{t('visitedOn')}</label>
          <input className="input" type="date" max={today}
            value={form.visited_on} onChange={e => set('visited_on', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">{t('clinic')}</label>
          <input className="input" placeholder={t('clinicPlaceholder')}
            value={form.clinic} onChange={e => set('clinic', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('reason')}</label>
        <input className="input" placeholder={t('reasonPlaceholder')}
          value={form.reason} onChange={e => set('reason', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('diagnosis')}</label>
        <input className="input" placeholder={t('diagnosisPlaceholder')}
          value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('treatment')}</label>
        <textarea className="input min-h-[60px]" placeholder={t('treatmentPlaceholder')}
          value={form.treatment} onChange={e => set('treatment', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">{t('medication')}</label>
          <input className="input" placeholder={t('medicationPlaceholder')}
            value={form.medication} onChange={e => set('medication', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">{t('cost')}</label>
          <input className="input" type="number" inputMode="numeric" min={0} placeholder={t('costPlaceholder')}
            value={form.cost} onChange={e => set('cost', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('nextVisit')}</label>
        <input className="input" type="date"
          value={form.next_visit_on} onChange={e => set('next_visit_on', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('photoLabel')}</label>
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
        {saving ? tc('saving') : tc('save')}
      </button>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Breed, Species } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { todayKST } from '@/lib/utils'

export default function NewPetPage() {
  const t = useTranslations('petForm')
  const tc = useTranslations('common')
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [species, setSpecies] = useState<Species>('dog')
  const [form, setForm] = useState({
    name: '', breed_id: '', birth_year: '', birth_month: '', birth_day: '', adopted_on: '', gender: '', weight_kg: '',
  })

  const { data: allBreeds } = useQuery({
    queryKey: ['breeds-all'],
    queryFn: async () => {
      const { data } = await supabase.from('breeds').select('id,name_ko,species').order('name_ko')
      return (data ?? []) as Pick<Breed, 'id' | 'name_ko' | 'species'>[]
    },
  })
  const breeds = (allBreeds ?? []).filter(b => b.species === species)
  const breedLabel = species === 'dog' ? t('breedDog') : t('breedCat')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // 필드별 인라인 검증 — 폼이 길어 하단 배너 하나만으로는 어느 항목이 문제인지 알기 어렵다.
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      const first = FIELD_ORDER.find(k => errs[k])
      if (first) document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFieldErrors({})
    const name = form.name.trim()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError(tc('loginRequired'))
      return
    }
    const { error: insErr } = await supabase.from('pets').insert({
      user_id: user.id,
      name,
      breed_id: form.breed_id,
      birth_year: parseInt(form.birth_year),
      birth_month: parseInt(form.birth_month),
      birth_day: form.birth_day ? parseInt(form.birth_day) : null,
      adopted_on: form.adopted_on || null,
      gender: form.gender,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      photo_url: photoUrl,
      species,
    })
    setSaving(false)
    if (insErr) {
      setError(t('errCreateFailed'))
      return
    }
    queryClient.invalidateQueries({ queryKey: ['my-pets'] })
    router.push('/dashboard')
  }

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    // 사용자가 값을 고치면 해당 필드 오류를 즉시 해제한다.
    const ek = k === 'breed_id' ? 'breed' : k
    if (fieldErrors[ek]) setFieldErrors(prev => ({ ...prev, [ek]: '' }))
  }

  const FIELD_ORDER = ['name', 'breed', 'birth_year', 'birth_month', 'gender'] as const
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = t('errNameRequired')
    if (!form.breed_id) errs.breed = t('errBreedRequired')
    if (!form.birth_year) errs.birth_year = t('errBirthYearRequired')
    if (!form.birth_month) errs.birth_month = t('errBirthMonthRequired')
    if (!form.gender) errs.gender = t('errGenderRequired')
    return errs
  }
  // 오류 시 붉은 테두리 + 필드 하단 메시지 (input 전역 클래스 뒤에 붙여 우선 적용)
  const errBorder = (k: string) => (fieldErrors[k] ? ' !border-red-400' : '')
  const FieldError = ({ k }: { k: string }) =>
    fieldErrors[k] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[k]}</p> : null

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('speciesLabel')}</label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('speciesAria')}>
            {([['dog', t('speciesDog')], ['cat', t('speciesCat')]] as const).map(([sp, label]) => (
              <button key={sp} type="button" role="radio" aria-checked={species === sp}
                onClick={() => { setSpecies(sp); set('breed_id', '') }}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  species === sp
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t('photo')}</label>
          <ImagePicker
            bucket="pet-photos"
            value={photoUrl}
            onUploaded={url => { setPhotoUrl(url); setPhotoError(null) }}
            onError={setPhotoError}
            shape="circle"
          />
          {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
        </div>

        <div id="field-name">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('name')}</label>
          <input className={`input${errBorder('name')}`} placeholder={t('namePlaceholder')} value={form.name}
            onChange={e => set('name', e.target.value)} aria-invalid={!!fieldErrors.name} maxLength={20} />
          <FieldError k="name" />
        </div>

        <div id="field-breed">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('breedLabel', { breed: breedLabel })}</label>
          <select className={`input${errBorder('breed')}`} value={form.breed_id}
            onChange={e => set('breed_id', e.target.value)} aria-invalid={!!fieldErrors.breed}>
            <option value="">{t('breedSelect', { breed: breedLabel })}</option>
            {breeds.map(b => <option key={b.id} value={b.id}>{b.name_ko}</option>)}
          </select>
          <FieldError k="breed" />
        </div>

        <div>
          <div className="grid grid-cols-3 gap-3">
            <div id="field-birth_year">
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthYear')}</label>
              <input className={`input${errBorder('birth_year')}`} type="number" placeholder="2022" min="2000" max={new Date().getFullYear()}
                value={form.birth_year} onChange={e => set('birth_year', e.target.value)} aria-invalid={!!fieldErrors.birth_year} />
            </div>
            <div id="field-birth_month">
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthMonth')}</label>
              <select className={`input${errBorder('birth_month')}`} value={form.birth_month}
                onChange={e => set('birth_month', e.target.value)} aria-invalid={!!fieldErrors.birth_month}>
                <option value="">{t('monthSelect')}</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>{t('monthN', { n: i+1 })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthDay')}</label>
              <select className="input" value={form.birth_day} onChange={e => set('birth_day', e.target.value)}>
                <option value="">{t('daySelect')}</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i+1} value={i+1}>{t('dayN', { n: i+1 })}</option>
                ))}
              </select>
            </div>
          </div>
          <FieldError k="birth_year" />
          <FieldError k="birth_month" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('adoptedOn')}</label>
          <input className="input" type="date" max={todayKST()}
            value={form.adopted_on} onChange={e => set('adopted_on', e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">{t('adoptedHint')}</p>
        </div>

        <div id="field-gender">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('gender')}</label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('genderAria')}>
            {['수컷', '암컷'].map(g => (
              <button key={g} type="button" role="radio" aria-checked={form.gender === g}
                onClick={() => set('gender', g)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.gender === g
                    ? 'bg-primary-500 text-white border-primary-500'
                    : `bg-white text-gray-600 ${fieldErrors.gender ? 'border-red-400' : 'border-gray-200'}`
                }`}>
                {g === '수컷' ? t('genderMale') : t('genderFemale')}
              </button>
            ))}
          </div>
          <FieldError k="gender" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('weight')}</label>
          <input className="input" type="number" placeholder={t('weightPlaceholder')} step="0.1" min="0"
            value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3 mt-2">
          {saving ? tc('saving') : t('submit')}
        </button>
      </form>
    </div>
  )
}

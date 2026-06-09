'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Breed, Species } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'

export default function NewPetPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [species, setSpecies] = useState<Species>('dog')
  const [form, setForm] = useState({
    name: '', breed_id: '', birth_year: '', birth_month: '', gender: '', weight_kg: '',
  })

  const { data: allBreeds } = useQuery({
    queryKey: ['breeds-all'],
    queryFn: async () => {
      const { data } = await supabase.from('breeds').select('id,name_ko,species').order('name_ko')
      return (data ?? []) as Pick<Breed, 'id' | 'name_ko' | 'species'>[]
    },
  })
  const breeds = (allBreeds ?? []).filter(b => b.species === species)
  const breedLabel = species === 'dog' ? '견종' : '묘종'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insErr } = await supabase.from('pets').insert({
      user_id: user!.id,
      name: form.name,
      breed_id: form.breed_id,
      birth_year: parseInt(form.birth_year),
      birth_month: parseInt(form.birth_month),
      gender: form.gender,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      photo_url: photoUrl,
      species,
    })
    setSaving(false)
    if (insErr) {
      setError('등록에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['my-pets'] })
    router.push('/dashboard')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">반려동물 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">종류 *</label>
          <div className="grid grid-cols-2 gap-2">
            {([['dog', '🐶 강아지'], ['cat', '🐱 고양이']] as const).map(([sp, label]) => (
              <button key={sp} type="button"
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
          <label className="text-sm font-medium text-gray-700 block mb-2">사진</label>
          <ImagePicker
            bucket="pet-photos"
            value={photoUrl}
            onUploaded={url => { setPhotoUrl(url); setPhotoError(null) }}
            onError={setPhotoError}
            shape="circle"
          />
          {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">이름 *</label>
          <input className="input" placeholder="예: 콩이" value={form.name}
            onChange={e => set('name', e.target.value)} required />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{breedLabel} *</label>
          <select className="input" value={form.breed_id}
            onChange={e => set('breed_id', e.target.value)} required>
            <option value="">{breedLabel} 선택</option>
            {breeds.map(b => <option key={b.id} value={b.id}>{b.name_ko}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">태어난 년도 *</label>
            <input className="input" type="number" placeholder="2022" min="2000" max={new Date().getFullYear()}
              value={form.birth_year} onChange={e => set('birth_year', e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">태어난 월 *</label>
            <select className="input" value={form.birth_month}
              onChange={e => set('birth_month', e.target.value)} required>
              <option value="">월 선택</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={i+1}>{i+1}월</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">성별 *</label>
          <div className="grid grid-cols-2 gap-2">
            {['수컷', '암컷'].map(g => (
              <button key={g} type="button"
                onClick={() => set('gender', g)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.gender === g
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {g === '수컷' ? '♂ 수컷' : '♀ 암컷'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">몸무게 (kg)</label>
          <input className="input" type="number" placeholder="예: 3.5" step="0.1" min="0"
            value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3 mt-2">
          {saving ? '저장 중...' : '등록 완료'}
        </button>
      </form>
    </div>
  )
}

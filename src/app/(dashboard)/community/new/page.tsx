'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Pet, PostCategory } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'

const CATEGORIES: PostCategory[] = ['질문', '자랑', '정보공유', '일상']

export default function NewPostPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: '' as PostCategory | '',
    title: '',
    content: '',
    breed_id: '',
  })

  // 내 반려동물 (견종 태그 자동 추천용)
  const { data: pets } = useQuery({
    queryKey: ['my-pets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase
        .from('pets')
        .select('id, name, breed_id, breed:breeds(name_ko)')
        .eq('user_id', user.id)
      return (data ?? []) as unknown as (Pick<Pet, 'id' | 'name' | 'breed_id'> & {
        breed?: { name_ko: string }
      })[]
    },
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category) {
      setError('카테고리를 선택해주세요')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: insErr } = await supabase
      .from('posts')
      .insert({
        user_id: user!.id,
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        breed_id: form.breed_id || null,
        image_url: imageUrl,
      })
      .select('id')
      .single()
    setSaving(false)
    if (insErr) {
      setError('등록에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    router.push(`/community/${data!.id}`)
    router.refresh()
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400" aria-label="뒤로">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">글쓰기</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 카테고리 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">카테고리 *</label>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="카테고리" aria-required>
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.category === c}
                onClick={() => set('category', c)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.category === c
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">제목 *</label>
          <input
            className="input"
            placeholder="제목을 입력하세요"
            maxLength={100}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
            aria-required
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">내용 *</label>
          <textarea
            className="input min-h-[160px] resize-y"
            placeholder="내용을 입력하세요"
            maxLength={5000}
            value={form.content}
            onChange={e => set('content', e.target.value)}
            required
            aria-required
          />
        </div>

        {/* 사진 (선택) */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            사진 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <ImagePicker
            bucket="post-images"
            value={imageUrl}
            onUploaded={setImageUrl}
            onError={setError}
          />
        </div>

        {/* 품종 태그 (선택) */}
        {pets && pets.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              품종 태그 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <select
              className="input"
              value={form.breed_id}
              onChange={e => set('breed_id', e.target.value)}
            >
              <option value="">선택 안 함</option>
              {/* 중복 견종 제거 */}
              {Array.from(
                new Map(
                  pets
                    .filter(p => p.breed_id)
                    .map(p => [p.breed_id, p.breed?.name_ko ?? ''])
                ).entries()
              ).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 mt-2">
          {saving ? '등록 중...' : '등록'}
        </button>
      </form>
    </div>
  )
}

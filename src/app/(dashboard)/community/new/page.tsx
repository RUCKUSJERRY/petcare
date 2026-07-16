'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Pet, PostCategory } from '@/types'
import { MultiImagePicker } from '@/components/ui/MultiImagePicker'
import { BackButton } from '@/components/ui/BackButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'

const CATEGORIES: PostCategory[] = ['질문', '자랑', '정보공유', '일상']

export default function NewPostPage() {
  const t = useTranslations('community')
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
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

  // 작성 중 뒤로가기/새로고침 시 입력 유실 방지 (저장 완료 후엔 dirty 아님)
  const tc = useTranslations('common')
  const dirty = !saving && (
    !!form.title.trim() || !!form.content.trim() || !!form.category || imageUrls.length > 0
  )
  const { promptLeave, confirmLeave, cancelLeave } = useUnsavedGuard(dirty)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // 폼이 길어 하단 배너 하나만으로는 어느 항목이 문제인지 알기 어렵다 — 누락된 첫 항목으로
    // 스크롤해 어디를 고쳐야 하는지 바로 보이게 한다. (반려동물 등록 폼과 동일한 패턴)
    if (!form.category || !form.title.trim() || !form.content.trim()) {
      setError(form.category ? t('contentRequired') : t('categoryRequired'))
      const first = !form.category ? 'category' : !form.title.trim() ? 'title' : 'content'
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError(t('loginRequired'))
      return
    }
    const { data, error: insErr } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        breed_id: form.breed_id || null,
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls.length ? imageUrls : null,
      })
      .select('id')
      .single()
    setSaving(false)
    if (insErr) {
      setError(t('createFailed'))
      return
    }
    router.push(`/community/${data!.id}`)
    router.refresh()
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref="/community" />
        <h1 className="text-xl font-bold text-gray-900">{t('write')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 카테고리 */}
        <div id="field-category">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('categoryLabel')}</label>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('category')} aria-required>
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
        <div id="field-title">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('titleLabel')}</label>
          <input
            className="input"
            placeholder={t('titlePlaceholder')}
            maxLength={100}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
            aria-required
          />
        </div>

        {/* 내용 */}
        <div id="field-content">
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('contentLabel')}</label>
          <textarea
            className="input min-h-[160px] resize-y"
            placeholder={t('contentPlaceholder')}
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
            {t('photo')} <span className="text-gray-400 font-normal">{t('optional')}</span>
          </label>
          <MultiImagePicker
            bucket="post-images"
            value={imageUrls}
            onChange={setImageUrls}
            onError={setError}
          />
        </div>

        {/* 품종 태그 (선택) */}
        {pets && pets.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t('breedTag')} <span className="text-gray-400 font-normal">{t('optional')}</span>
            </label>
            <select
              className="input"
              value={form.breed_id}
              onChange={e => set('breed_id', e.target.value)}
            >
              <option value="">{t('breedNone')}</option>
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
          {saving ? t('submitting') : t('submit')}
        </button>
      </form>

      {promptLeave && (
        <ConfirmModal
          title={tc('leaveTitle')}
          description={tc('leaveDesc')}
          confirmLabel={tc('leaveConfirm')}
          cancelLabel={tc('keepEditing')}
          destructive
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  )
}

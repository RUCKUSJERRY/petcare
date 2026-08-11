'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PostCategory, Post } from '@/types'
import { MultiImagePicker } from '@/components/ui/MultiImagePicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'
import { useMyPets } from '@/hooks/useMyPets'

const CATEGORIES: PostCategory[] = ['질문', '자랑', '정보공유', '일상']

export default function EditPostPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const t = useTranslations('community')
  const tc = useTranslations('common')
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({
    category: '' as PostCategory | '',
    title: '',
    content: '',
    breed_id: '',
  })
  // 불러온 원본 스냅샷 — 편집 중 실제로 바뀐 게 있을 때만 이탈 가드를 띄우기 위해 비교 기준으로 쓴다.
  const initialRef = useRef<{ category: string; title: string; content: string; breed_id: string; images: string } | null>(null)

  // 기존 게시글 불러오기. 편집 권한(존재·소유) 판정만 여기서 하고, 실제 화면 이동은 렌더 이후
  // effect 에서 한다 — 라우팅은 부작용이라 queryFn 안에서 하면 재조회·창 포커스 복귀마다 다시
  // 실행돼, 일시적 조회 실패 때 정상 소유자도 읽기 화면으로 튕길 수 있다.
  const { data: postResult } = useQuery({
    queryKey: ['post', params.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', params.id)
        .single()
      const p = data as Post | null
      if (!p || p.user_id !== user?.id) return { post: null, denied: true as const }
      return { post: p, denied: false as const }
    },
  })
  const post = postResult?.post ?? null

  // 없는 글/남의 글이면 편집 불가 → 읽기 화면으로 되돌린다.
  useEffect(() => {
    if (postResult?.denied) router.replace(`/community/${params.id}`)
  }, [postResult, router, params.id])

  useEffect(() => {
    if (post && !loaded) {
      const images = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : [])
      setForm({
        category: post.category,
        title: post.title,
        content: post.content,
        breed_id: post.breed_id ?? '',
      })
      setImageUrls(images)
      initialRef.current = {
        category: post.category, title: post.title, content: post.content,
        breed_id: post.breed_id ?? '', images: images.join(','),
      }
      setLoaded(true)
    }
  }, [post, loaded])

  // 편집 중 뒤로가기/새로고침 시 수정분 유실 방지 — 원본과 달라진 게 있을 때만 확인을 띄운다.
  const init = initialRef.current
  const dirty = !saving && loaded && init != null && (
    form.category !== init.category || form.title !== init.title ||
    form.content !== init.content || form.breed_id !== init.breed_id ||
    imageUrls.join(',') !== init.images
  )
  const { promptLeave, confirmLeave, cancelLeave } = useUnsavedGuard(dirty)

  // 견종 태그 추천용 — 앱 전역과 동일한 공용 캐시('my-pets')를 그대로 쓴다(교차 오염 방지).
  const { data: pets } = useMyPets()

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category) {
      setError(t('categoryRequired'))
      return
    }
    if (!form.title.trim() || !form.content.trim()) {
      setError(t('contentRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const { error: updErr } = await supabase
      .from('posts')
      .update({
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        breed_id: form.breed_id || null,
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls.length ? imageUrls : null,
      })
      .eq('id', params.id)
    setSaving(false)
    if (updErr) {
      setError(t('updateFailed'))
      return
    }
    router.push(`/community/${params.id}`)
    router.refresh()
  }

  if (!loaded) return <div className="px-4 py-6 text-gray-400">{t('loading')}</div>

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400" aria-label={t('back')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('editTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 카테고리 */}
        <div>
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
        <div>
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
        <div>
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
              {Array.from(
                new Map(
                  pets
                    .filter(p => p.breed_id)
                    .map(p => [p.breed_id as string, p.breed?.name_ko ?? ''])
                ).entries()
              ).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full py-3 mt-2">
          {saving ? t('updating') : t('updateSubmit')}
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

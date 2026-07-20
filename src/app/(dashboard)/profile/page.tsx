'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { LogoutButton } from '@/components/ui/LogoutButton'
import { BackButton } from '@/components/ui/BackButton'
import { PushToggle } from '@/components/ui/PushToggle'
import { OPEN_ONBOARDING_EVENT } from '@/components/ui/OnboardingModal'
import { deleteImageByUrl } from '@/lib/upload'
import Link from 'next/link'
import { usePlan } from '@/hooks/usePlan'

export default function ProfilePage() {
  const router = useRouter()
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { isPremium } = usePlan()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const { data: isAdmin } = useQuery<boolean>({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const { data } = await supabase.rpc('is_admin')
      return !!data
    },
  })

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      return data as Profile | null
    },
  })

  // 폼 초기값을 쿼리 데이터에서 동기화.
  // queryFn이 캐시로 인해 재실행되지 않아도, 마운트 시 캐시된 데이터로 초기화됨.
  useEffect(() => {
    if (profile && !loaded) {
      setDisplayName(profile.display_name)
      setAvatarUrl(profile.avatar_url)
      setLoaded(true)
    }
  }, [profile, loaded])

  const handleSave = async () => {
    const name = displayName.trim()
    if (!name) {
      setError(t('nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      setError(tc('loginRequired'))
      return
    }
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ display_name: name, avatar_url: avatarUrl })
      .eq('id', user.id)
    setSaving(false)
    if (updErr) {
      setError(t('saveFailed'))
      return
    }
    // 사진을 바꾼/지운 경우 기존 커밋 파일 정리(고아 방지)
    if (profile?.avatar_url && profile.avatar_url !== avatarUrl) {
      deleteImageByUrl(profile.avatar_url)
    }
    // 저장된 값으로 캐시 갱신 → 재방문 시 폼이 최신 상태를 반영
    queryClient.setQueryData<Profile | null>(['my-profile'], prev =>
      prev ? { ...prev, display_name: name, avatar_url: avatarUrl } : prev
    )
    setDone(true)
    router.refresh()
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t('photo')}</label>
          <ImagePicker
            bucket="avatars"
            value={avatarUrl}
            onUploaded={setAvatarUrl}
            onError={setError}
            shape="circle"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('nickname')}</label>
          <input
            className="input"
            placeholder={t('nicknamePlaceholder')}
            maxLength={20}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t('nicknameHint')}
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {/* 저장 성공을 버튼 라벨 변화(잠깐 '저장됨')로만 알리면 놓치기 쉬워, 별도 상태 줄로도
            분명히 알린다(스크린리더에도 role=status 로 안내). */}
        {done && <p role="status" className="text-sm text-green-600 font-medium">✓ {t('saved')}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
          {saving ? tc('saving') : t('saveButton')}
        </button>

        {/* 프리미엄 진입점 */}
        <Link
          href="/premium"
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-2xl shrink-0" aria-hidden>👑</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{t('premium')}</div>
            <div className="text-xs text-gray-400">{isPremium ? t('premiumActive') : t('premiumHint')}</div>
          </div>
          <span className="text-gray-300 shrink-0" aria-hidden>›</span>
        </Link>

        {/* 관리자 진입점 (관리자에게만 노출) */}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl shrink-0" aria-hidden>🛠️</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{t('admin')}</div>
              <div className="text-xs text-gray-400">{t('adminHint')}</div>
            </div>
            <span className="text-gray-300 shrink-0" aria-hidden>›</span>
          </Link>
        )}

        {/* 알림 설정 */}
        <div className="border-t border-gray-100 pt-4">
          <PushToggle />
        </div>

        {/* 사용 안내 다시 보기 */}
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT))}
          className="text-sm text-gray-500 hover:text-primary-600"
        >
          {t('viewOnboarding')}
        </button>
      </div>
    </div>
  )
}

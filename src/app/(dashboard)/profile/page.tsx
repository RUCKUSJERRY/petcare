'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { LogoutButton } from '@/components/ui/LogoutButton'
import { PushToggle } from '@/components/ui/PushToggle'
import { deleteImageByUrl } from '@/lib/upload'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

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
      setError('닉네임을 입력해주세요')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ display_name: name, avatar_url: avatarUrl })
      .eq('id', user!.id)
    setSaving(false)
    if (updErr) {
      setError('저장에 실패했어요. 다시 시도해주세요.')
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
        <button onClick={() => router.back()} className="text-gray-400" aria-label="뒤로">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">프로필 편집</h1>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">프로필 사진</label>
          <ImagePicker
            bucket="avatars"
            value={avatarUrl}
            onUploaded={setAvatarUrl}
            onError={setError}
            shape="circle"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">닉네임</label>
          <input
            className="input"
            placeholder="커뮤니티에 표시될 이름"
            maxLength={20}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            커뮤니티 글·댓글에 이 이름이 표시돼요
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
          {saving ? '저장 중...' : done ? '저장됐어요 ✓' : '저장하기'}
        </button>

        {/* 알림 설정 */}
        <div className="border-t border-gray-100 pt-4">
          <PushToggle />
        </div>
      </div>
    </div>
  )
}

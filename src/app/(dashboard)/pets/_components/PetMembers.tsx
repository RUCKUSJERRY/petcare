'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShareButton } from '@/components/ui/ShareButton'
import type { PetMember } from '@/types'

/**
 * 반려동물 공동 관리 구성원 섹션.
 * - owner: 구성원 초대(링크 생성) + 구성원 내보내기
 * - 모든 구성원: 목록 조회 + 본인 탈퇴(나가기)
 */
export function PetMembers({ petId, petName }: { petId: string; petName: string }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [supabase])

  const { data: members = [] } = useQuery({
    queryKey: ['pet-members', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pet_members')
        .select('*, profile:profiles(display_name, avatar_url)')
        .eq('pet_id', petId)
        .order('created_at')
      return (data ?? []) as PetMember[]
    },
  })

  const myRole = members.find(m => m.user_id === uid)?.role
  const isOwner = myRole === 'owner'

  const createInvite = async () => {
    if (creating || !uid) return
    setCreating(true); setError(null)
    const { data, error: e } = await supabase
      .from('pet_invitations')
      .insert({ pet_id: petId, invited_by: uid })
      .select('token')
      .single()
    setCreating(false)
    if (e || !data) { setError('초대 링크 생성에 실패했어요.'); return }
    setInviteToken((data as { token: string }).token)
  }

  const removeMember = async (memberUserId: string) => {
    setBusy(true)
    await supabase.from('pet_members').delete().eq('pet_id', petId).eq('user_id', memberUserId)
    setBusy(false)
    qc.invalidateQueries({ queryKey: ['pet-members', petId] })
  }

  const leave = async () => {
    if (!uid) return
    if (!confirm(`${petName} 공동 관리에서 나갈까요?`)) return
    setBusy(true)
    await supabase.from('pet_members').delete().eq('pet_id', petId).eq('user_id', uid)
    setBusy(false)
    qc.invalidateQueries({ queryKey: ['my-pets'] })
    router.push('/dashboard')
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">공동 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">가족·친구를 초대해 함께 기록·관리해요</p>
        </div>
        {isOwner && (
          <button onClick={createInvite} disabled={creating} className="text-sm text-primary-600 font-semibold shrink-0">
            {creating ? '생성 중…' : '+ 초대'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {inviteToken && (
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-600">아래 링크를 보내면 상대가 구성원으로 참여할 수 있어요. (14일간 유효)</p>
          <ShareButton
            path={`/invite/${inviteToken}`}
            title={`${petName} 공동 관리 초대`}
            text={`${petName}를 함께 관리해요. 링크를 열어 참여해주세요.`}
            label="초대 링크 공유"
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.user_id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
              {m.profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : '🐾'}
            </div>
            <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
              {m.profile?.display_name ?? '구성원'}
              {m.user_id === uid && <span className="text-gray-400"> (나)</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
              m.role === 'owner' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {m.role === 'owner' ? '소유자' : '구성원'}
            </span>
            {isOwner && m.role !== 'owner' && (
              <button onClick={() => removeMember(m.user_id)} disabled={busy}
                className="text-xs text-gray-300 hover:text-red-500 shrink-0">내보내기</button>
            )}
          </div>
        ))}
      </div>

      {!isOwner && myRole && (
        <button onClick={leave} disabled={busy}
          className="w-full py-2 text-sm text-gray-400 hover:text-red-500">
          공동 관리에서 나가기
        </button>
      )}
    </div>
  )
}

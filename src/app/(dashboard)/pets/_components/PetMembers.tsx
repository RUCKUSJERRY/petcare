'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShareButton } from '@/components/ui/ShareButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { PetMember } from '@/types'

/**
 * 반려동물 공동 관리 구성원 섹션.
 * - owner: 구성원 초대(링크 생성) + 구성원 내보내기
 * - 모든 구성원: 목록 조회 + 본인 탈퇴(나가기)
 */
export function PetMembers({ petId, petName }: { petId: string; petName: string }) {
  const t = useTranslations('petMembers')
  const supabase = createClient()
  const qc = useQueryClient()
  const router = useRouter()
  const [uid, setUid] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 소유권 이전 확인 대상(구성원)
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null)

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
    if (e || !data) { setError(t('errInviteFailed')); return }
    setInviteToken((data as { token: string }).token)
  }

  const removeMember = async (memberUserId: string) => {
    setBusy(true); setError(null)
    const { error: delErr } = await supabase.from('pet_members').delete().eq('pet_id', petId).eq('user_id', memberUserId)
    setBusy(false)
    if (delErr) { setError(t('errRemoveFailed')); return }
    qc.invalidateQueries({ queryKey: ['pet-members', petId] })
  }

  // 소유권 이전 — 서버 함수(transfer_pet_ownership)가 'owner 만 호출·대상은 기존 구성원' 을
  // 검증하고 역할 교체 + pets.user_id 갱신을 원자적으로 처리한다.
  const transferOwnership = async (memberUserId: string) => {
    setBusy(true); setError(null)
    const { error: e } = await supabase.rpc('transfer_pet_ownership', {
      p_pet_id: petId, p_new_owner: memberUserId,
    })
    setBusy(false)
    setTransferTarget(null)
    if (e) { setError(t('errTransferFailed')); return }
    qc.invalidateQueries({ queryKey: ['pet-members', petId] })
    qc.invalidateQueries({ queryKey: ['pet', petId] })
    qc.invalidateQueries({ queryKey: ['my-pets'] })
  }

  const leave = async () => {
    if (!uid) return
    if (!confirm(t('leaveConfirm', { name: petName }))) return
    setBusy(true); setError(null)
    const { error: delErr } = await supabase.from('pet_members').delete().eq('pet_id', petId).eq('user_id', uid)
    setBusy(false)
    if (delErr) { setError(t('errLeaveFailed')); return }
    qc.invalidateQueries({ queryKey: ['my-pets'] })
    router.push('/dashboard')
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('subtitle')}</p>
        </div>
        {isOwner && (
          <button onClick={createInvite} disabled={creating} className="text-sm text-primary-600 font-semibold shrink-0">
            {creating ? t('creating') : t('invite')}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {inviteToken && (
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-600">{t('inviteHint')}</p>
          <ShareButton
            path={`/invite/${inviteToken}`}
            title={t('shareTitle', { name: petName })}
            text={t('shareText', { name: petName })}
            label={t('shareLabel')}
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
              {m.profile?.display_name ?? t('member')}
              {m.user_id === uid && <span className="text-gray-400"> {t('me')}</span>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
              m.role === 'owner' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {m.role === 'owner' ? t('roleOwner') : t('roleMember')}
            </span>
            {isOwner && m.role !== 'owner' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setTransferTarget({ userId: m.user_id, name: m.profile?.display_name ?? t('member') })}
                  disabled={busy}
                  className="text-xs text-gray-400 hover:text-primary-600">{t('transfer')}</button>
                <button onClick={() => removeMember(m.user_id)} disabled={busy}
                  className="text-xs text-gray-300 hover:text-red-500">{t('remove')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 소유권 이전 안내 (owner + 넘길 구성원이 있을 때) */}
      {isOwner && members.some(m => m.role !== 'owner') && (
        <p className="text-xs text-gray-400">{t('transferHint')}</p>
      )}

      {transferTarget && (
        <ConfirmModal
          title={t('transfer')}
          description={t('transferConfirm', { name: transferTarget.name })}
          confirmLabel={t('transferDo')}
          busy={busy}
          onConfirm={() => transferOwnership(transferTarget.userId)}
          onCancel={() => setTransferTarget(null)}
        />
      )}

      {!isOwner && myRole && (
        <button onClick={leave} disabled={busy}
          className="w-full py-2 text-sm text-gray-400 hover:text-red-500">
          {t('leave')}
        </button>
      )}
    </div>
  )
}

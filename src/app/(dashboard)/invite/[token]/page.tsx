'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type InviteInfo = {
  pet_id: string
  pet_name: string | null
  status: 'pending' | 'accepted' | 'revoked'
  expired: boolean
  inviter: string | null
}

export default function InviteAcceptPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const router = useRouter()
  const qc = useQueryClient()
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined) // undefined=로딩
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_pet_invitation', { p_token: params.token }).then(({ data }) => {
      setInfo((data as InviteInfo) ?? null)
    })
  }, [supabase, params.token])

  const accept = async () => {
    setAccepting(true); setError(null)
    const { data, error: e } = await supabase.rpc('accept_pet_invitation', { p_token: params.token })
    setAccepting(false)
    if (e) {
      setError(
        e.message?.includes('expired') ? '만료된 초대예요.'
          : e.message?.includes('not_pending') ? '이미 사용되었거나 취소된 초대예요.'
            : '초대를 수락하지 못했어요.'
      )
      return
    }
    qc.invalidateQueries({ queryKey: ['my-pets'] })
    router.replace(`/pets/${data as string}`)
  }

  return (
    <div className="px-4 py-10 flex flex-col items-center text-center space-y-4">
      <div className="text-5xl">🐾</div>

      {info === undefined ? (
        <p className="text-gray-400">초대 정보를 불러오는 중...</p>
      ) : info === null ? (
        <>
          <h1 className="text-lg font-bold text-gray-900">유효하지 않은 초대예요</h1>
          <p className="text-sm text-gray-500">링크가 잘못되었거나 만료되었어요.</p>
          <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">홈으로</Link>
        </>
      ) : info.status !== 'pending' || info.expired ? (
        <>
          <h1 className="text-lg font-bold text-gray-900">사용할 수 없는 초대예요</h1>
          <p className="text-sm text-gray-500">
            {info.expired ? '초대가 만료되었어요.' : '이미 사용되었거나 취소된 초대예요.'}
          </p>
          <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">홈으로</Link>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold text-gray-900">
            {info.inviter ? `${info.inviter}님이` : '누군가'} 초대했어요
          </h1>
          <p className="text-sm text-gray-600">
            <b className="text-primary-600">{info.pet_name ?? '반려동물'}</b>의 공동 관리에 참여하면
            <br />모든 기록을 함께 보고 남길 수 있어요.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={accept} disabled={accepting} className="btn-primary w-full max-w-xs py-3 text-sm">
            {accepting ? '참여 중...' : '공동 관리 참여하기'}
          </button>
          <Link href="/dashboard" className="text-sm text-gray-400">나중에</Link>
        </>
      )}
    </div>
  )
}

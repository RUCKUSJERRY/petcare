'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('invite')
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
        e.message?.includes('expired') ? t('errorExpired')
          : e.message?.includes('not_pending') ? t('alreadyUsed')
            : t('acceptFailed')
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
        <p className="text-gray-400">{t('loading')}</p>
      ) : info === null ? (
        <>
          <h1 className="text-lg font-bold text-gray-900">{t('invalidTitle')}</h1>
          <p className="text-sm text-gray-500">{t('invalidDesc')}</p>
          <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">{t('home')}</Link>
        </>
      ) : info.status !== 'pending' || info.expired ? (
        <>
          <h1 className="text-lg font-bold text-gray-900">{t('unusableTitle')}</h1>
          <p className="text-sm text-gray-500">
            {info.expired ? t('expiredDesc') : t('alreadyUsed')}
          </p>
          <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-sm">{t('home')}</Link>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold text-gray-900">
            {info.inviter ? `${t('invitedBy', { name: info.inviter })} ${t('invitedSuffix')}` : `${t('invitedBySomeone')} ${t('invitedSuffix')}`}
          </h1>
          <p className="text-sm text-gray-600">
            <b className="text-primary-600">{info.pet_name ?? t('petFallback')}</b>{t('joinDesc1')}
            <br />{t('joinDesc2')}
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={accept} disabled={accepting} className="btn-primary w-full max-w-xs py-3 text-sm">
            {accepting ? t('joining') : t('joinButton')}
          </button>
          <Link href="/dashboard" className="text-sm text-gray-400">{t('later')}</Link>
        </>
      )}
    </div>
  )
}

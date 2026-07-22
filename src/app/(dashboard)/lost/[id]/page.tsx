'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { timeAgo } from '@/lib/utils'
import { ShareButton } from '@/components/ui/ShareButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { notifyNewSighting } from '../_actions'
import type { LostPet, LostPetSighting } from '@/types'

export default function LostDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const t = useTranslations('lost')
  const [me, setMe] = useState<string | null>(null)
  const [showContact, setShowContact] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sightErr, setSightErr] = useState<string | null>(null)
  // 상태 전환(찾음 종료 / 다시 찾는 중)은 실종 목록·지도에서 신고를 넣고 빼는 되돌리기 쉬운
  // 실수라, 확인 모달 + 진행중 표시 + 실패 안내를 둔다.
  const [statusAction, setStatusAction] = useState<null | 'found' | 'active'>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null))
  }, [supabase])

  const { data: pet, isPending } = useQuery({
    queryKey: ['lost-pet', params.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lost_pets')
        .select('*, breed:breeds(name_ko)')
        .eq('id', params.id)
        .maybeSingle()
      return (data ?? null) as unknown as LostPet | null
    },
  })

  const { data: sightings = [] } = useQuery({
    queryKey: ['lost-sightings', params.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lost_pet_sightings')
        .select('*')
        .eq('lost_pet_id', params.id)
        .order('created_at', { ascending: true })
      const rows = (data ?? []) as LostPetSighting[]
      const ids = Array.from(new Set(rows.map(r => r.user_id)))
      const map = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
        for (const p of (profs ?? []) as any[]) map.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
      }
      return rows.map(r => ({ ...r, author: map.get(r.user_id) ?? { display_name: t('anonymousGuardian'), avatar_url: null } }))
    },
  })

  // 미니 지도
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    if (!pet) return
    const ll = new maps.LatLng(pet.lat, pet.lng)
    const map = new maps.Map(el, { center: ll, level: 4 })
    new maps.Marker({ position: ll, map })
    map.setDraggable(false); map.setZoomable(false)
  }, [pet])

  const isAuthor = !!me && pet?.user_id === me

  const applyStatus = async (status: 'found' | 'active') => {
    setStatusBusy(true)
    setStatusErr(null)
    const { error } = await supabase.from('lost_pets').update({ status }).eq('id', params.id)
    setStatusBusy(false)
    if (error) { setStatusErr(t('statusUpdateError')); return }
    setStatusAction(null)
    qc.invalidateQueries({ queryKey: ['lost-pet', params.id] })
    qc.invalidateQueries({ queryKey: ['lost-pets'] })
  }

  const addSighting = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setSightErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); setSightErr(t('sightingErrLogin')); return }
    const { data: inserted, error } = await supabase
      .from('lost_pet_sightings')
      .insert({ lost_pet_id: params.id, user_id: user.id, content })
      .select('id')
      .single()
    setSending(false)
    if (error) { setSightErr(t('sightingErrFail')); return }
    setText('')
    qc.invalidateQueries({ queryKey: ['lost-sightings', params.id] })
    // in-app 알림은 DB 트리거가 남기고, 폰 푸시만 서버액션으로 추가 발송(베스트 에포트).
    if (inserted?.id) notifyNewSighting(inserted.id as string).catch(() => {})
  }

  // 로딩 중(isPending)과 조회가 끝났는데도 없음(삭제/잘못된 링크/권한없음)을 구분한다.
  // 예전엔 두 경우 모두 '불러오는 중'만 떠서, 삭제된 신고에 진입하면 영원히 로딩처럼 보였다.
  if (isPending) return <div className="px-4 py-6 text-gray-400">{t('loading')}</div>
  if (!pet) return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('reportTitle')} fallbackHref="/lost" />
      <EmptyState
        variant="error"
        icon="🐾"
        title={t('notFound')}
        hint={t('notFoundHint')}
        action={
          <Link href="/lost" className="btn-primary text-sm py-1.5 px-4 inline-block">
            {t('toList')}
          </Link>
        }
      />
    </div>
  )

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('reportTitle')} fallbackHref="/lost" />

      {pet.status === 'found' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm text-center font-medium">
          {t('foundBanner')}
        </div>
      )}

      {(pet.photo_urls?.length ? pet.photo_urls : (pet.photo_url ? [pet.photo_url] : [])).map((src: string, i: number) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={t('photoAltNamed', { name: pet.name ?? t('unknownName') })} className="w-full rounded-2xl object-cover max-h-72" />
      ))}

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">{pet.name ?? t('unknownName')}</h1>
          <span className="text-sm text-gray-400">{pet.species === 'cat' ? t('speciesCat') : t('speciesDog')}</span>
        </div>
        <p className="text-sm text-gray-500">
          {pet.breed?.name_ko ?? ''}{pet.gender ? ` · ${pet.gender}` : ''} · {t('lostDateLabel')} {pet.lost_at}
        </p>
        {pet.area_text && <p className="text-sm text-gray-500">📍 {pet.area_text}</p>}
      </div>

      {kakaoNotice(mapStatus) ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-400">
          {kakaoNotice(mapStatus)}
        </div>
      ) : (
        <div ref={mapRef} className="w-full h-52 rounded-2xl border border-gray-200 overflow-hidden bg-gray-100" />
      )}

      {pet.description && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{pet.description}</p>
      )}

      {/* 연락처 */}
      {pet.contact && pet.contact_public && (
        showContact ? (
          <a href={`tel:${pet.contact}`} className="btn-primary w-full py-3 block text-center">📞 {pet.contact}</a>
        ) : (
          <button onClick={() => setShowContact(true)} className="btn-primary w-full py-3">{t('showContact')}</button>
        )
      )}

      {/* 널리 알리기 — 비로그인도 볼 수 있는 공개 페이지 링크 공유 */}
      <ShareButton
        path={`/share/lost/${pet.id}`}
        title={t('shareSearchingTitle', { name: pet.name ?? t('unknownName') })}
        text={pet.area_text ? t('shareTextWithArea', { area: pet.area_text }) : t('shareTextNoArea')}
        label={t('shareReportLabel')}
        className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-sm font-medium"
      />

      {isAuthor && pet.status === 'active' && (
        <button onClick={() => { setStatusErr(null); setStatusAction('found') }}
          className="w-full py-3 rounded-lg border border-green-300 text-green-600 text-sm font-semibold hover:bg-green-50">
          {t('markFound')}
        </button>
      )}

      {/* 종료된 신고도 실수/오탐일 수 있어, 작성자가 '다시 찾는 중'으로 되돌릴 수 있게 한다 */}
      {isAuthor && pet.status === 'found' && (
        <button onClick={() => { setStatusErr(null); setStatusAction('active') }}
          className="w-full py-3 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50">
          {t('revertToActive')}
        </button>
      )}

      {statusErr && <p className="text-sm text-red-500 text-center">{statusErr}</p>}

      {statusAction && (
        <ConfirmModal
          title={statusAction === 'found' ? t('markFoundConfirmTitle') : t('revertConfirmTitle')}
          description={statusAction === 'found' ? t('markFoundConfirmDesc') : t('revertConfirmDesc')}
          confirmLabel={statusAction === 'found' ? t('markFoundConfirm') : t('revertConfirm')}
          busy={statusBusy}
          onConfirm={() => applyStatus(statusAction)}
          onCancel={() => setStatusAction(null)}
        />
      )}

      <hr className="border-gray-100" />

      {/* 목격 제보 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">{t('sightingTitle')} <span className="text-primary-500">{sightings.length}</span></h3>
        <form onSubmit={addSighting} className="flex gap-2">
          <input className="input flex-1" placeholder={t('sightingPlaceholder')} maxLength={1000}
            value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 shrink-0">{t('sightingSubmit')}</button>
        </form>
        {sightErr && <p className="text-xs text-red-500 -mt-1">{sightErr}</p>}
        <div className="space-y-3">
          {sightings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">{t('sightingEmpty')}</p>
          ) : sightings.map(s => (
            <div key={s.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {s.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.author.avatar_url} alt={s.author.display_name ?? t('anonymousGuardian')} className="w-full h-full object-cover" />
                ) : '🐾'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.author?.display_name ?? t('anonymousGuardian')}</span>
                  <span className="text-xs text-gray-400">{timeAgo(s.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{s.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { hasKakaoKey, loadKakaoMaps } from '@/lib/kakao'
import { timeAgo } from '@/lib/utils'
import type { LostPet, LostPetSighting } from '@/types'

export default function LostDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const mapRef = useRef<HTMLDivElement>(null)
  const [me, setMe] = useState<string | null>(null)
  const [showContact, setShowContact] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null))
  }, [supabase])

  const { data: pet } = useQuery({
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
      return rows.map(r => ({ ...r, author: map.get(r.user_id) ?? { display_name: '익명의 보호자', avatar_url: null } }))
    },
  })

  // 미니 지도
  useEffect(() => {
    if (!hasKakaoKey() || !mapRef.current || !pet) return
    let cancelled = false
    loadKakaoMaps().then(maps => {
      if (cancelled || !mapRef.current) return
      const ll = new maps.LatLng(pet.lat, pet.lng)
      const map = new maps.Map(mapRef.current, { center: ll, level: 4 })
      new maps.Marker({ position: ll, map })
      map.setDraggable(false); map.setZoomable(false)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pet])

  const isAuthor = !!me && pet?.user_id === me

  const markFound = async () => {
    await supabase.from('lost_pets').update({ status: 'found' }).eq('id', params.id)
    qc.invalidateQueries({ queryKey: ['lost-pet', params.id] })
    qc.invalidateQueries({ queryKey: ['lost-pets'] })
  }

  const addSighting = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }
    await supabase.from('lost_pet_sightings').insert({ lost_pet_id: params.id, user_id: user.id, content })
    setText('')
    setSending(false)
    qc.invalidateQueries({ queryKey: ['lost-sightings', params.id] })
  }

  if (!pet) return <div className="px-4 py-6 text-gray-400">불러오는 중...</div>

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title="실종 신고" fallbackHref="/lost" />

      {pet.status === 'found' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm text-center font-medium">
          ✅ 가족 품으로 돌아갔어요
        </div>
      )}

      {pet.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pet.photo_url} alt="" className="w-full rounded-2xl object-cover max-h-72" />
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">{pet.name ?? '이름 미상'}</h1>
          <span className="text-sm text-gray-400">{pet.species === 'cat' ? '고양이' : '강아지'}</span>
        </div>
        <p className="text-sm text-gray-500">
          {pet.breed?.name_ko ?? ''}{pet.gender ? ` · ${pet.gender}` : ''} · 실종일 {pet.lost_at}
        </p>
        {pet.area_text && <p className="text-sm text-gray-500">📍 {pet.area_text}</p>}
      </div>

      {hasKakaoKey() && (
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
          <button onClick={() => setShowContact(true)} className="btn-primary w-full py-3">연락처 보기</button>
        )
      )}

      {isAuthor && pet.status === 'active' && (
        <button onClick={markFound} className="w-full py-3 rounded-lg border border-green-300 text-green-600 text-sm font-semibold hover:bg-green-50">
          ✓ 찾았어요 (신고 종료)
        </button>
      )}

      <hr className="border-gray-100" />

      {/* 목격 제보 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">목격 제보 <span className="text-primary-500">{sightings.length}</span></h3>
        <form onSubmit={addSighting} className="flex gap-2">
          <input className="input flex-1" placeholder="목격하신 정보를 남겨주세요" maxLength={1000}
            value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 shrink-0">등록</button>
        </form>
        <div className="space-y-3">
          {sightings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">아직 목격 제보가 없어요</p>
          ) : sightings.map(s => (
            <div key={s.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {s.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : '🐾'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.author?.display_name ?? '익명의 보호자'}</span>
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

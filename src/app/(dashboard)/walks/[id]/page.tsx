'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { formatDistance, formatDuration, formatPace } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { Walk } from '@/types'

type WalkRow = Walk & {
  pet?: { name: string } | null
  author?: { display_name: string } | null
}

export default function WalkDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()
  const [uid, setUid] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const fittedRef = useRef(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [supabase])

  const { data: walk, refetch } = useQuery({
    queryKey: ['walk', params.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('walks')
        .select('*, pet:pets(name), author:profiles(display_name)')
        .eq('id', params.id)
        .single()
      return data as WalkRow | null
    },
  })

  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const map = new maps.Map(el, { center: new maps.LatLng(37.5665, 126.978), level: 4 })
    ;(el as any).__map = map
    ;(el as any).__maps = maps
  }, [])

  // 경로가 로드되면 폴리라인 + 시작/끝 마커 + 영역 맞춤
  useEffect(() => {
    const el = mapRef.current as any
    if (!el?.__map || !walk || fittedRef.current) return
    const maps = el.__maps
    const map = el.__map
    const path: [number, number][] = Array.isArray(walk.path) ? walk.path : []
    if (path.length === 0) return
    const latlngs = path.map(p => new maps.LatLng(p[0], p[1]))
    new maps.Polyline({ path: latlngs, strokeWeight: 6, strokeColor: '#16a34a', strokeOpacity: 0.9 }).setMap(map)
    new maps.Marker({ position: latlngs[0], map }) // 시작
    if (latlngs.length > 1) new maps.Marker({ position: latlngs[latlngs.length - 1], map }) // 끝
    const bounds = new maps.LatLngBounds()
    latlngs.forEach((ll: any) => bounds.extend(ll))
    map.setBounds(bounds)
    fittedRef.current = true
  }, [walk, mapRef, mapStatus])

  const isOwner = !!walk && walk.user_id === uid

  const toggleShare = async () => {
    if (!walk) return
    setBusy(true)
    await supabase.from('walks').update({ is_public: !walk.is_public }).eq('id', walk.id)
    setBusy(false)
    refetch()
    qc.invalidateQueries({ queryKey: ['walks'] })
  }

  const handleDelete = async () => {
    if (!walk) return
    await supabase.from('walks').delete().eq('id', walk.id)
    qc.invalidateQueries({ queryKey: ['walks'] })
    router.replace('/walks')
  }

  const notice = kakaoNotice(mapStatus)

  if (!walk) return <div className="px-4 py-6 text-gray-400">불러오는 중...</div>

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-400" aria-label="뒤로">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 truncate px-2">{walk.title || '산책'}</h1>
        <div className="w-6" />
      </div>

      {/* 경로 지도 */}
      <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100">
        <div ref={mapRef} className="absolute inset-0" />
        {notice && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-gray-500">
            {notice}
          </div>
        )}
      </div>

      {/* 통계 */}
      <div className="card grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xl font-bold text-primary-600 tabular-nums">{formatDistance(walk.distance_m)}</div>
          <div className="text-xs text-gray-400 mt-0.5">거리</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 tabular-nums">{formatDuration(walk.duration_s)}</div>
          <div className="text-xs text-gray-400 mt-0.5">시간</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 tabular-nums">{formatPace(walk.distance_m, walk.duration_s)}</div>
          <div className="text-xs text-gray-400 mt-0.5">평균 페이스</div>
        </div>
      </div>

      {/* 메타 */}
      <div className="card space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">날짜</span>
          <span className="text-gray-700">{new Date(walk.started_at).toLocaleString('ko-KR')}</span></div>
        {walk.pet?.name && (
          <div className="flex justify-between"><span className="text-gray-400">함께한 아이</span>
            <span className="text-gray-700">{walk.pet.name}</span></div>
        )}
        {!isOwner && walk.author?.display_name && (
          <div className="flex justify-between"><span className="text-gray-400">공유자</span>
            <span className="text-gray-700">{walk.author.display_name}</span></div>
        )}
        {walk.note && (
          <div className="pt-1 text-gray-600 whitespace-pre-wrap border-t border-gray-50">{walk.note}</div>
        )}
      </div>

      {/* 소유자 액션 */}
      {isOwner && (
        <div className="space-y-2">
          <button
            onClick={toggleShare}
            disabled={busy}
            className={walk.is_public
              ? 'w-full py-3 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 text-sm font-medium'
              : 'btn-primary w-full py-3 text-sm'}
          >
            {walk.is_public ? '★ 공유 중 — 공유 해제하기' : '☆ 이 경로 공유하기'}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="w-full py-3 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            산책 기록 삭제
          </button>
        </div>
      )}

      {showDelete && (
        <ConfirmModal
          title="산책 기록 삭제"
          description="삭제한 기록은 복구할 수 없어요. 정말 삭제할까요?"
          confirmLabel="삭제"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}

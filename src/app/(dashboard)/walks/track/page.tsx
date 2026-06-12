'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { useMyPets } from '@/hooks/useMyPets'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { formatDistance, formatDuration, formatPace, haversineMeters } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { WalkPoint } from '@/types'

type Phase = 'idle' | 'tracking' | 'finished'

export default function WalkTrackPage() {
  const router = useRouter()
  const supabase = createClient()
  const { data: pets } = useMyPets()
  const { selectedPetId } = useSelectedPet()

  const [phase, setPhase] = useState<Phase>('idle')
  const [distance, setDistance] = useState(0)   // m
  const [elapsed, setElapsed] = useState(0)     // s
  const [points, setPoints] = useState(0)       // 점 개수(표시용)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 저장 폼
  const [petId, setPetId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [note, setNote] = useState('')

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const meMarkerRef = useRef<any>(null)
  const pathRef = useRef<WalkPoint[]>([])
  const distRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const endedAtRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const map = new maps.Map(el, { center: new maps.LatLng(37.5665, 126.978), level: 3 })
    mapsRef.current = maps
    mapObjRef.current = map
    polylineRef.current = new maps.Polyline({
      path: [], strokeWeight: 6, strokeColor: '#16a34a', strokeOpacity: 0.9, strokeStyle: 'solid',
    })
    polylineRef.current.setMap(map)
    // 시작 전 현재 위치로 중심 이동
    navigator.geolocation?.getCurrentPosition(
      p => map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude)),
      undefined,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

  // 기본 산책 동반 아이 = 헤더에서 선택된 아이
  useEffect(() => {
    if (selectedPetId) setPetId(selectedPetId)
    else if (pets && pets.length === 1) setPetId(pets[0].id)
  }, [selectedPetId, pets])

  const drawPoint = (lat: number, lng: number) => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    if (!maps || !map) return
    const latlng = new maps.LatLng(lat, lng)
    const path = pathRef.current.map(p => new maps.LatLng(p[0], p[1]))
    polylineRef.current?.setPath(path)
    if (!meMarkerRef.current) {
      meMarkerRef.current = new maps.Marker({ position: latlng, map })
    } else {
      meMarkerRef.current.setPosition(latlng)
    }
    map.panTo(latlng)
  }

  const onPosition = (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const last = pathRef.current[pathRef.current.length - 1]
    if (last) {
      const d = haversineMeters({ lat: last[0], lng: last[1] }, { lat, lng })
      // 3m 미만 이동은 GPS 노이즈로 보고 무시 (거리 부풀림 방지)
      if (d < 3) return
      distRef.current += d
      setDistance(distRef.current)
    }
    pathRef.current.push([lat, lng])
    setPoints(pathRef.current.length)
    drawPoint(lat, lng)
  }

  const start = () => {
    if (!navigator.geolocation) {
      setGeoError('이 기기에서는 위치 추적을 사용할 수 없어요.')
      return
    }
    setGeoError(null)
    pathRef.current = []
    distRef.current = 0
    setDistance(0)
    setPoints(0)
    startedAtRef.current = Date.now()
    setElapsed(0)
    setPhase('tracking')
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const stopWatch = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const finish = () => {
    stopWatch()
    endedAtRef.current = Date.now()
    setElapsed(Math.floor((endedAtRef.current - startedAtRef.current) / 1000))
    const now = new Date()
    setTitle(`${now.getMonth() + 1}월 ${now.getDate()}일 산책`)
    setPhase('finished')
  }

  // 언마운트 시 추적 정리
  useEffect(() => () => stopWatch(), [])

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setGeoError('로그인이 필요해요.'); return }
    const { data, error } = await supabase.from('walks').insert({
      user_id: user.id,
      pet_id: petId || null,
      title: title.trim() || null,
      started_at: new Date(startedAtRef.current).toISOString(),
      ended_at: new Date(endedAtRef.current).toISOString(),
      duration_s: Math.floor((endedAtRef.current - startedAtRef.current) / 1000),
      distance_m: Math.round(distRef.current),
      path: pathRef.current,
      is_public: isPublic,
      note: note.trim() || null,
    }).select('id').single()
    setSaving(false)
    if (error) { setGeoError('저장에 실패했어요. 다시 시도해주세요.'); return }
    router.replace(`/walks/${(data as { id: string }).id}`)
  }

  const discard = () => {
    if (confirm('이 산책 기록을 저장하지 않고 나갈까요?')) router.replace('/walks')
  }

  const notice = kakaoNotice(mapStatus)

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg top-[52px] bottom-0 z-30 bg-gray-100 overflow-hidden flex flex-col">
      {/* 지도 */}
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />
        {notice && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/90 p-6 text-center text-sm text-gray-500 max-w-xs">
              {notice}
              <p className="mt-2 text-xs text-gray-400">지도가 없어도 거리·시간 기록은 동작해요.</p>
            </div>
          </div>
        )}

        {/* 실시간 통계 오버레이 */}
        <div className="absolute top-3 inset-x-3 z-10 bg-white/95 rounded-2xl shadow-md px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-600 tabular-nums">{formatDistance(distance)}</div>
            <div className="text-xs text-gray-400 mt-0.5">거리</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatDuration(elapsed)}</div>
            <div className="text-xs text-gray-400 mt-0.5">시간</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatPace(distance, elapsed)}</div>
            <div className="text-xs text-gray-400 mt-0.5">페이스</div>
          </div>
        </div>

        {phase === 'tracking' && (
          <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-center">
            <span className="text-xs text-gray-500 bg-white/90 rounded-full px-3 py-1 shadow-sm">
              화면을 켠 채로 두면 더 정확해요 · 기록점 {points}개
            </span>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 pb-6 space-y-3">
        {geoError && <p className="text-sm text-red-500 text-center">{geoError}</p>}

        {phase === 'idle' && (
          <div className="space-y-2">
            <button onClick={start} className="btn-primary w-full py-3.5 text-base font-semibold">
              ▶ 산책 시작
            </button>
            <button onClick={() => router.back()} className="w-full py-2 text-sm text-gray-400">
              취소
            </button>
          </div>
        )}

        {phase === 'tracking' && (
          <button onClick={finish} className="w-full py-3.5 rounded-lg bg-red-500 text-white text-base font-semibold">
            ■ 산책 종료
          </button>
        )}

        {phase === 'finished' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">제목</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="산책 제목" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">함께한 아이 (선택)</label>
              <select className="input" value={petId} onChange={e => setPetId(e.target.value)}>
                <option value="">선택 안 함</option>
                {(pets ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">메모 (선택)</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="예: 오프리쉬존, 산책로 추천 포인트" />
            </div>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-primary-500" />
              <span className="text-sm text-gray-700">이 경로를 공유하기 <span className="text-gray-400">(좋은 산책로·오프리쉬존으로 다른 사용자에게 공개)</span></span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={discard} className="btn-secondary py-3 text-sm">저장 안 함</button>
              <button onClick={save} disabled={saving} className="btn-primary py-3 text-sm">
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

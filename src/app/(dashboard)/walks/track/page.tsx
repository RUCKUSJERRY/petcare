'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { useMyPets } from '@/hooks/useMyPets'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { formatDistance, formatDuration, formatPace, haversineMeters } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { WalkPoint } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { deleteImageByUrl } from '@/lib/upload'

type Phase = 'idle' | 'tracking' | 'finished'

// 이 시간(ms) 이상 움직임이 없으면 자동 일시정지 (Nike Run Club식 auto-pause)
const AUTO_PAUSE_MS = 20000

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

export default function WalkTrackPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('walks')
  const tc = useTranslations('common')
  const { data: pets } = useMyPets()
  const { selectedPetId } = useSelectedPet()

  const [phase, setPhase] = useState<Phase>('idle')
  const [paused, setPaused] = useState(false)
  const [distance, setDistance] = useState(0)   // m
  const [elapsed, setElapsed] = useState(0)     // s (정지 시간 제외)
  const [points, setPoints] = useState(0)       // 점 개수(표시용)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 저장 폼
  const [petId, setPetId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const meMarkerRef = useRef<any>(null)
  const pathRef = useRef<WalkPoint[]>([])
  const distRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)   // 최초 시작 시각(벽시계)
  const endedAtRef = useRef<number>(0)     // 종료 시각(벽시계)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 정지 시간을 제외한 실제 진행 시간 계산용
  const runningMsRef = useRef(0)               // 누적 진행 ms(정지 구간 제외)
  const segStartRef = useRef<number | null>(null) // 현재 진행 구간 시작(정지 중이면 null)
  const lastMoveRef = useRef<number>(0)        // 마지막으로 유의미하게 움직인 시각
  const autoPausedRef = useRef(false)          // 자동 일시정지 상태(움직이면 자동 재개)

  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const map = new maps.Map(el, { center: new maps.LatLng(37.5665, 126.978), level: 3 })
    mapsRef.current = maps
    mapObjRef.current = map
    polylineRef.current = new maps.Polyline({
      path: [], strokeWeight: 6, strokeColor: '#16a34a', strokeOpacity: 0.9, strokeStyle: 'solid',
    })
    polylineRef.current.setMap(map)
    navigator.geolocation?.getCurrentPosition(
      p => map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude)),
      undefined,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

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

  const updateElapsed = () => {
    const now = Date.now()
    const ms = runningMsRef.current + (segStartRef.current != null ? now - segStartRef.current : 0)
    setElapsed(Math.floor(ms / 1000))
  }

  const doPause = (auto: boolean) => {
    if (segStartRef.current == null) return // 이미 정지
    runningMsRef.current += Date.now() - segStartRef.current
    segStartRef.current = null
    autoPausedRef.current = auto
    setPaused(true)
    updateElapsed()
  }

  const doResume = () => {
    if (segStartRef.current != null) return // 이미 진행 중
    segStartRef.current = Date.now()
    lastMoveRef.current = Date.now()
    autoPausedRef.current = false
    setPaused(false)
  }

  const onPosition = (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const now = Date.now()
    const last = pathRef.current[pathRef.current.length - 1]
    if (last) {
      const d = haversineMeters({ lat: last[0], lng: last[1] }, { lat, lng })
      // 3m 미만 이동은 GPS 노이즈로 보고 무시 (거리 부풀림 방지)
      if (d < 3) return
      // 유의미한 움직임 → 자동 정지였다면 자동 재개
      if (autoPausedRef.current) doResume()
      lastMoveRef.current = now
      // 수동 일시정지 중이면 거리/경로에 반영하지 않음 (마커만 갱신)
      if (segStartRef.current == null) {
        drawPoint(lat, lng)
        return
      }
      distRef.current += d
      setDistance(distRef.current)
    } else {
      lastMoveRef.current = now
    }
    pathRef.current.push([lat, lng])
    setPoints(pathRef.current.length)
    drawPoint(lat, lng)
  }

  const start = () => {
    if (!navigator.geolocation) {
      setGeoError(t('errNoGeo'))
      return
    }
    setGeoError(null)
    pathRef.current = []
    distRef.current = 0
    runningMsRef.current = 0
    const now = Date.now()
    startedAtRef.current = now
    segStartRef.current = now
    lastMoveRef.current = now
    autoPausedRef.current = false
    setDistance(0); setPoints(0); setElapsed(0); setPaused(false)
    setPhase('tracking')
    timerRef.current = setInterval(() => {
      updateElapsed()
      // 일정 시간 움직임이 없으면 자동 일시정지
      if (segStartRef.current != null && Date.now() - lastMoveRef.current > AUTO_PAUSE_MS) {
        doPause(true)
      }
    }, 500)
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(t('errPermission'))
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
    // 진행 중 구간을 누적에 반영하고 정지
    if (segStartRef.current != null) {
      runningMsRef.current += Date.now() - segStartRef.current
      segStartRef.current = null
    }
    stopWatch()
    endedAtRef.current = Date.now()
    setElapsed(Math.floor(runningMsRef.current / 1000))
    setPaused(false)
    const now = new Date()
    setTitle(t('defaultTitle', { m: now.getMonth() + 1, d: now.getDate() }))
    setPhase('finished')
  }

  useEffect(() => () => stopWatch(), [])

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setGeoError(t('errLoginRequired')); return }
    const { data, error } = await supabase.from('walks').insert({
      user_id: user.id,
      pet_id: petId || null,
      title: title.trim() || null,
      started_at: new Date(startedAtRef.current).toISOString(),
      ended_at: new Date(endedAtRef.current).toISOString(),
      duration_s: Math.floor(runningMsRef.current / 1000),
      distance_m: Math.round(distRef.current),
      path: pathRef.current,
      is_public: isPublic,
      note: note.trim() || null,
      photo_url: photoUrl,
    }).select('id').single()
    setSaving(false)
    if (error) {
      // 저장 실패 시 방금 올린 사진은 고아가 되므로 정리
      if (photoUrl) deleteImageByUrl(photoUrl)
      setGeoError(t('errSaveRetry'))
      return
    }
    router.replace(`/walks/${(data as { id: string }).id}`)
  }

  const discard = () => {
    if (confirm(t('discardConfirm'))) {
      // 저장하지 않고 폐기 → 업로드된 사진도 정리
      if (photoUrl) deleteImageByUrl(photoUrl)
      router.replace('/walks')
    }
  }

  const notice = kakaoNotice(mapStatus)

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg top-[52px] bottom-0 z-[60] bg-gray-100 overflow-hidden flex flex-col">
      {/* 지도 */}
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />
        {notice && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/90 p-6 text-center text-sm text-gray-500 max-w-xs">
              {notice}
              <p className="mt-2 text-xs text-gray-400">{t('mapFallbackHint')}</p>
            </div>
          </div>
        )}

        {/* 실시간 통계 오버레이 */}
        <div className="absolute top-3 inset-x-3 z-10 bg-white/95 rounded-2xl shadow-md px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-600 tabular-nums">{formatDistance(distance)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t('distance')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatDuration(elapsed)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t('time')}{paused && phase === 'tracking' ? ' ⏸' : ''}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatPace(distance, elapsed)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t('pace')}</div>
          </div>
        </div>

        {phase === 'tracking' && (
          <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-center">
            <span className="text-xs text-gray-600 bg-white/90 rounded-full px-3 py-1 shadow-sm">
              {paused
                ? (autoPausedRef.current ? t('autoPausedHint') : t('pausedHint'))
                : t('trackingStatus', { time: hhmm(startedAtRef.current), points })}
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
              ▶ {t('startTracking')}
            </button>
            <button onClick={() => router.back()} className="w-full py-2 text-sm text-gray-400">
              {tc('cancel')}
            </button>
          </div>
        )}

        {phase === 'tracking' && (
          <div className="grid grid-cols-2 gap-2">
            {paused ? (
              <button onClick={doResume} className="py-3.5 rounded-lg bg-primary-500 text-white text-base font-semibold">
                ▶ {t('resume')}
              </button>
            ) : (
              <button onClick={() => doPause(false)} className="py-3.5 rounded-lg bg-gray-700 text-white text-base font-semibold">
                ⏸ {t('pause')}
              </button>
            )}
            <button onClick={finish} className="py-3.5 rounded-lg bg-red-500 text-white text-base font-semibold">
              ■ {t('finish')}
            </button>
          </div>
        )}

        {phase === 'finished' && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* 시작/종료 시각 요약 */}
            <div className="flex justify-center gap-4 text-xs text-gray-500">
              <span>{t('startTime')} <b className="text-gray-700 tabular-nums">{hhmm(startedAtRef.current)}</b></span>
              <span>{t('endTime')} <b className="text-gray-700 tabular-nums">{hhmm(endedAtRef.current)}</b></span>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('titleLabel')}</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('withPetOptional')}</label>
              <select className="input" value={petId} onChange={e => setPetId(e.target.value)}>
                <option value="">{t('petNone')}</option>
                {(pets ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('noteOptional')}</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder={t('notePlaceholder')} />
            </div>
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 accent-primary-500" />
              <span className="text-sm text-gray-700">{t('shareThisRoute')} <span className="text-gray-400">{t('shareHint')}</span></span>
            </label>

            {/* 산책 사진 (선택) — 기록과 함께 저장됨 */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('photoOptional')}</label>
              <ImagePicker
                bucket="pet-photos"
                value={photoUrl}
                onUploaded={url => { setPhotoUrl(url); setPhotoError(null) }}
                onError={setPhotoError}
              />
              {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={discard} className="btn-secondary py-3 text-sm">{t('discard')}</button>
              <button onClick={save} disabled={saving} className="btn-primary py-3 text-sm">
                {saving ? tc('saving') : t('saveWalk')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { useMyPets } from '@/hooks/useMyPets'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { formatDistance, formatDuration, formatPace, haversineMeters } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { WalkPoint } from '@/types'
import { WalkPhotoComposer } from '../_components/WalkPhotoComposer'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { deleteImageByUrl } from '@/lib/upload'
import { useInterstitialAd } from '@/hooks/useInterstitialAd'
import {
  saveWalkSession,
  loadWalkSession,
  clearWalkSession,
  type WalkSession,
} from '@/lib/walkSession'

type Phase = 'idle' | 'tracking' | 'finished'

// 이 시간(ms) 이상 움직임이 없으면 자동 일시정지 (Nike Run Club식 auto-pause)
const AUTO_PAUSE_MS = 20000

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

export default function WalkTrackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const qc = useQueryClient()
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
  // idle 단계 위치 준비 상태(null=확인 중, true=확인됨, false=실패). '시작 전에 GPS가 준비됐는지'를
  // 눈으로 보여줘, 목록에서 넘어온 idle 화면이 불필요한 한 단계처럼 느껴지지 않게 한다.
  const [locReady, setLocReady] = useState<boolean | null>(null)

  // 저장 폼
  const [petId, setPetId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // 추적 중 오탭으로 종료되거나, 작성 중인 산책이 날아가는 것을 막는 확인 모달
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // 앱이 실수로 종료됐다가 다시 들어왔을 때, 저장돼 있던 진행 중 산책(복구 후보)
  const [recovered, setRecovered] = useState<WalkSession | null>(null)

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const meMarkerRef = useRef<any>(null)
  const pathRef = useRef<WalkPoint[]>([])
  const distRef = useRef(0)
  // 거리 계산 기준점(마지막으로 채택된 좌표). 일시정지 중에도 이 기준점은 갱신하되
  // 거리·경로에는 반영하지 않아, 재개 시 정지 구간 이동거리가 한꺼번에 더해지는 걸 막는다.
  const lastPosRef = useRef<WalkPoint | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)   // 최초 시작 시각(벽시계)
  const endedAtRef = useRef<number>(0)     // 종료 시각(벽시계)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 정지 시간을 제외한 실제 진행 시간 계산용
  const runningMsRef = useRef(0)               // 누적 진행 ms(정지 구간 제외)
  const segStartRef = useRef<number | null>(null) // 현재 진행 구간 시작(정지 중이면 null)
  const lastMoveRef = useRef<number>(0)        // 마지막으로 유의미하게 움직인 시각
  const autoPausedRef = useRef(false)          // 자동 일시정지 상태(움직이면 자동 재개)
  const autoStartedRef = useRef(false)         // 홈 바로가기 자동 시작을 1회만 실행하기 위한 가드

  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const map = new maps.Map(el, { center: new maps.LatLng(37.5665, 126.978), level: 3 })
    mapsRef.current = maps
    mapObjRef.current = map
    polylineRef.current = new maps.Polyline({
      path: [], strokeWeight: 6, strokeColor: '#16a34a', strokeOpacity: 0.9, strokeStyle: 'solid',
    })
    polylineRef.current.setMap(map)
    navigator.geolocation?.getCurrentPosition(
      p => {
        const ll = new maps.LatLng(p.coords.latitude, p.coords.longitude)
        map.setCenter(ll)
        // idle 단계에서 현재 위치 마커를 미리 찍어 'GPS 준비됨'을 눈으로 확인하게 한다.
        // (거리 계산 기준점 lastPosRef 는 여기서 건드리지 않는다 — start() 에서 새로 잡는다)
        if (!meMarkerRef.current) meMarkerRef.current = new maps.Marker({ position: ll, map })
        else meMarkerRef.current.setPosition(ll)
        setLocReady(true)
      },
      () => setLocReady(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

  useEffect(() => {
    if (selectedPetId) setPetId(selectedPetId)
    else if (pets && pets.length === 1) setPetId(pets[0].id)
  }, [selectedPetId, pets])

  // 산책 시작 직전 전면 광고(무료 사용자) — 프리미엄/광고비활성 시 즉시 시작
  const adSpecies = pets?.find(p => p.id === petId)?.species
  const { requestAd, adNode } = useInterstitialAd(adSpecies)

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

  // 복구/지도 로딩 지연에 대비해, 현재까지의 경로 전체를 다시 그린다.
  const redrawPath = () => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    if (!maps || !map || pathRef.current.length === 0) return
    polylineRef.current?.setPath(pathRef.current.map(p => new maps.LatLng(p[0], p[1])))
    const last = pathRef.current[pathRef.current.length - 1]
    const latlng = new maps.LatLng(last[0], last[1])
    if (!meMarkerRef.current) meMarkerRef.current = new maps.Marker({ position: latlng, map })
    else meMarkerRef.current.setPosition(latlng)
    map.setCenter(latlng)
  }

  // 진행 중 산책을 기기에 저장한다. 현재 진행 구간까지 닫아 elapsedMs 에 반영하므로,
  // 복구 시에는 '일시정지' 상태에서 이어가면 되고 앱이 꺼져 있던 시간은 포함되지 않는다.
  const persist = () => {
    if (startedAtRef.current === 0) return
    const now = Date.now()
    const elapsedMs = runningMsRef.current + (segStartRef.current != null ? now - segStartRef.current : 0)
    saveWalkSession({
      v: 1,
      startedAt: startedAtRef.current,
      elapsedMs,
      distance: distRef.current,
      path: pathRef.current,
      lastPos: lastPosRef.current,
      petId,
      savedAt: now,
    })
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
    persist()
  }

  const doResume = () => {
    if (segStartRef.current != null) return // 이미 진행 중
    segStartRef.current = Date.now()
    lastMoveRef.current = Date.now()
    autoPausedRef.current = false
    setPaused(false)
    persist()
  }

  const onPosition = (pos: GeolocationPosition) => {
    // 유효한 위치가 들어오면 직전의 일시적 위치 오류(타임아웃 등) 안내는 해제한다.
    setGeoError(null)
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const now = Date.now()
    const base = lastPosRef.current
    if (base) {
      const d = haversineMeters({ lat: base[0], lng: base[1] }, { lat, lng })
      // 3m 미만 이동은 GPS 노이즈로 보고 무시 (거리 부풀림 방지)
      if (d < 3) return
      // 유의미한 움직임 → 자동 정지였다면 자동 재개
      if (autoPausedRef.current) doResume()
      lastMoveRef.current = now
      // 기준점은 정지 여부와 무관하게 항상 현재 위치로 전진시킨다.
      // (정지 중 이동한 거리가 재개 시점에 한꺼번에 distRef 에 더해지는 버그 방지)
      lastPosRef.current = [lat, lng]
      // 수동 일시정지 중이면 거리/경로에 반영하지 않음 (마커만 갱신)
      if (segStartRef.current == null) {
        drawPoint(lat, lng)
        return
      }
      distRef.current += d
      setDistance(distRef.current)
    } else {
      lastMoveRef.current = now
      lastPosRef.current = [lat, lng]
    }
    pathRef.current.push([lat, lng])
    setPoints(pathRef.current.length)
    drawPoint(lat, lng)
    persist()
  }

  // 타이머 + 위치 감시 시작 — 새 산책 시작(start)과 복구 이어가기(resumeRecovered)에서 공용으로 쓴다.
  const beginWatch = () => {
    let tick = 0
    timerRef.current = setInterval(() => {
      updateElapsed()
      // 일정 시간 움직임이 없으면 자동 일시정지
      if (segStartRef.current != null && Date.now() - lastMoveRef.current > AUTO_PAUSE_MS) {
        doPause(true)
      }
      // 제자리 등으로 새 좌표가 안 들어와도 진행 시간이 최신으로 저장되도록 주기적으로 저장(약 4초).
      if (++tick % 8 === 0) persist()
    }, 500)
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      err => {
        // 권한 거부뿐 아니라 신호 없음(POSITION_UNAVAILABLE)·타임아웃(TIMEOUT)도 안내한다.
        // (예전엔 이 두 경우를 삼켜서, 실내 등으로 위치를 못 잡으면 0.00km 산책이 아무 설명 없이
        //  기록되던 문제가 있었다.) 유효한 위치가 잡히면 onPosition 에서 이 안내를 해제한다.
        setGeoError(err.code === err.PERMISSION_DENIED ? t('errPermission') : t('errLocationLost'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const start = () => {
    if (!navigator.geolocation) {
      setGeoError(t('errNoGeo'))
      return
    }
    setGeoError(null)
    setRecovered(null)
    clearWalkSession() // 새로 시작하면 남아있던 복구본은 버린다.
    pathRef.current = []
    distRef.current = 0
    // 거리 기준점을 새로 잡는다 — idle 마커로 잡힌 위치가 첫 구간에 잘못 더해지지 않게 한다.
    lastPosRef.current = null
    runningMsRef.current = 0
    const now = Date.now()
    startedAtRef.current = now
    segStartRef.current = now
    lastMoveRef.current = now
    autoPausedRef.current = false
    setDistance(0); setPoints(0); setElapsed(0); setPaused(false)
    setPhase('tracking')
    beginWatch()
  }

  // 저장돼 있던 진행 중 산책을 '일시정지' 상태로 복원해 이어서 기록한다.
  const resumeRecovered = () => {
    const s = recovered
    if (!s) return
    if (!navigator.geolocation) { setGeoError(t('errNoGeo')); return }
    setGeoError(null)
    setRecovered(null)
    pathRef.current = s.path.slice()
    distRef.current = s.distance
    // 거리 기준점은 새로 잡는다(null) — 앱이 꺼져 있던 동안의 이동이 재개 첫 좌표에서
    // 직선 거리로 한꺼번에 더해져 거리가 부풀려지는 걸 막는다. (start() 와 동일한 처리)
    lastPosRef.current = null
    runningMsRef.current = s.elapsedMs
    startedAtRef.current = s.startedAt
    segStartRef.current = null // 일시정지 상태로 복원(앱이 꺼져 있던 시간은 진행 시간에 넣지 않는다)
    lastMoveRef.current = Date.now()
    autoPausedRef.current = false
    if (s.petId) setPetId(s.petId)
    setDistance(s.distance)
    setPoints(s.path.length)
    setElapsed(Math.floor(s.elapsedMs / 1000))
    setPaused(true)
    setPhase('tracking')
    redrawPath()
    beginWatch()
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
    persist()
  }

  useEffect(() => () => stopWatch(), [])

  // 마운트 시 이전에 저장돼 있던 진행 중 산책이 있으면 복구를 제안한다.
  useEffect(() => {
    const s = loadWalkSession(Date.now())
    if (s) setRecovered(s)
  }, [])

  // 홈 '산책' 바로가기(autostart=1)로 진입한 경우: GPS가 준비됐고(locReady) 복구할 세션·오류가
  // 없으면 idle 한 단계를 건너뛰고 자동 시작한다. 광고 게이트는 그대로(requestAd 경유) 유지하고,
  // 복구 후보가 있으면 자동 시작 대신 복구 모달을 먼저 보여준다. 가드 ref 로 1회만 실행.
  useEffect(() => {
    if (autoStartedRef.current) return
    if (searchParams.get('autostart') !== '1') return
    if (phase !== 'idle' || locReady !== true || recovered || geoError) return
    autoStartedRef.current = true
    requestAd(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, phase, locReady, recovered, geoError])

  // 복구가 지도 로딩보다 먼저 일어났을 수 있으므로, 지도가 준비되고 추적 중이면 경로를 다시 그린다.
  useEffect(() => {
    if (phase === 'tracking' && mapStatus === 'ready') redrawPath()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStatus, phase])

  // 추적 중 새로고침·닫기 시 브라우저 기본 경고를 띄운다(데스크톱). 모바일에선 복구로 보완된다.
  useEffect(() => {
    if (phase !== 'tracking') return
    const handler = (e: BeforeUnloadEvent) => {
      persist()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

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
      // 저장 실패 시에는 사진을 지우지 않는다 — 사용자가 그대로 '다시 시도'할 수 있어야 한다.
      // (사진을 미리 지우면 재시도 시 깨진 photo_url로 저장되거나 사진이 사라진다.
      //  업로드된 파일은 폐기(discard) 시에만 정리한다.)
      setGeoError(t('errSaveRetry'))
      return
    }
    clearWalkSession() // 저장 완료 → 복구본 정리
    // 방금 저장한 산책이 앱 전반의 캐시(기본 staleTime 60s)에 즉시 반영되도록 무효화한다.
    // (편집·삭제 경로는 이미 ['walks']를 무효화하는데, 최초 저장 경로만 누락돼 있어 목록·홈
    //  요약·주간 리포트에서 새 산책이 최대 60초간 보이지 않았다.)
    qc.invalidateQueries({ queryKey: ['walks'] }) // 목록(mine/shared) 프리픽스 매칭
    qc.invalidateQueries({ queryKey: ['walk-goal'] }) // 이번 주 산책 목표 진행도
    if (petId) {
      qc.invalidateQueries({ queryKey: ['today-walk', petId] }) // 홈 '오늘의 돌봄' 산책 체크·기분
      qc.invalidateQueries({ queryKey: ['weekly-report', petId] }) // 주간 리포트 활동 합계
      // 지난달 회고 카드는 산책 거리를 합산한다. 편집·삭제 경로(walks/[id])는 이미 무효화하는데
      // 최초 저장 경로만 누락돼, 새 산책이 회고 거리에 최대 60초간 반영되지 않았다.
      qc.invalidateQueries({ queryKey: ['monthly-recap', petId] })
      // 아이 상세의 성장 레벨 카드(PetCharacterCard)는 기록 수 + 산책 수로 레벨을 계산한다.
      // 기록 경로만 이 키를 무효화하고 산책 경로들은 누락돼, 산책 직후 아이 상세를 열면
      // 레벨/포인트가 최대 60초간 옛 산책 수를 반영했다 — 저장·삭제·수동 산책 3경로에 함께 추가.
      qc.invalidateQueries({ queryKey: ['pet-care-points', petId] })
    }
    router.replace(`/walks/${(data as { id: string }).id}`)
  }

  const doDiscard = () => {
    setConfirmDiscard(false)
    clearWalkSession() // 폐기 → 복구본 정리
    // 저장하지 않고 폐기 → 업로드된 사진도 정리
    if (photoUrl) deleteImageByUrl(photoUrl)
    router.replace('/walks')
  }

  const notice = kakaoNotice(mapStatus)
  const finishedDate = new Date(startedAtRef.current || Date.now())
  const finishedDateLabel = t('dateLabel', { m: finishedDate.getMonth() + 1, d: finishedDate.getDate() })
  // 거리 50m 미만이면서 시간도 60초 미만이면 사실상 빈 산책 → 저장 차단(둘 중 하나만 넘어도 저장 허용)
  const tooShort = distRef.current < 50 && elapsed < 60

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg top-[52px] bottom-0 z-[60] bg-gray-100 overflow-hidden flex flex-col">
      {adNode}
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

        {/* idle 위치 준비 상태 — 시작 전에 GPS가 잡혔는지 눈으로 알려준다 */}
        {phase === 'idle' && !notice && (
          <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-center">
            <span className="text-xs text-gray-600 bg-white/90 rounded-full px-3 py-1 shadow-sm">
              {locReady === true ? t('idleReady') : locReady === false ? t('idleNoLoc') : t('idleLocating')}
            </span>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 pb-6 space-y-3">
        {geoError && <p className="text-sm text-red-500 text-center">{geoError}</p>}

        {phase === 'idle' && (
          <div className="space-y-2">
            <button onClick={() => requestAd(start)} className="btn-primary w-full py-3.5 text-base font-semibold">
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
            <button onClick={() => setConfirmFinish(true)} className="py-3.5 rounded-lg bg-red-500 text-white text-base font-semibold">
              ■ {t('finish')}
            </button>
          </div>
        )}

        {phase === 'finished' && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* 거리·시간·페이스 요약 — 지도 오버레이는 키보드/폼에 가려지므로 폼 안에도 다시 보여준다 */}
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
              <div>
                <div className="text-lg font-bold text-primary-600 tabular-nums">{formatDistance(distRef.current)}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{t('distance')}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">{formatDuration(elapsed)}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{t('time')}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">{formatPace(distRef.current, elapsed)}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{t('pace')}</div>
              </div>
            </div>
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

            {/* 산책 사진 → 기록을 입힌 합성 이미지 미리보기 (저장 시 함께 보관) */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('photoOptional')}</label>
              <WalkPhotoComposer
                distanceM={distRef.current}
                durationS={elapsed}
                dateLabel={finishedDateLabel}
                value={photoUrl}
                onChange={url => { setPhotoUrl(url); setPhotoError(null) }}
                onError={setPhotoError}
              />
              {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
            </div>

            {/* 오탭 등으로 생긴 사실상 빈 산책(거리·시간 모두 아주 작음)은 통계를 흐리므로 저장을 막는다 */}
            {tooShort && <p className="text-xs text-amber-600 text-center">{t('tooShortHint')}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmDiscard(true)} className="btn-secondary py-3 text-sm">{t('discard')}</button>
              <button onClick={save} disabled={saving || tooShort} className="btn-primary py-3 text-sm disabled:opacity-50">
                {saving ? tc('saving') : t('saveWalk')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 추적 중 ■ 종료 오탭 방지 확인 */}
      {confirmFinish && (
        <ConfirmModal
          title={t('finishConfirmTitle')}
          description={t('finishConfirmDesc')}
          confirmLabel={t('finish')}
          onConfirm={() => { setConfirmFinish(false); finish() }}
          onCancel={() => setConfirmFinish(false)}
        />
      )}

      {/* 저장 전 폐기 확인 (앱 톤 통일 — 기존 네이티브 confirm 대체) */}
      {confirmDiscard && (
        <ConfirmModal
          title={t('discardTitle')}
          description={t('discardConfirm')}
          confirmLabel={t('discard')}
          destructive
          onConfirm={doDiscard}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}

      {/* 앱이 꺼졌다 다시 들어온 경우 — 진행 중이던 산책 이어가기 제안 */}
      {recovered && phase === 'idle' && (
        <ConfirmModal
          title={t('recoverTitle')}
          description={t('recoverDesc', {
            distance: formatDistance(recovered.distance),
            time: formatDuration(Math.floor(recovered.elapsedMs / 1000)),
          })}
          confirmLabel={t('recoverResume')}
          cancelLabel={t('recoverDismiss')}
          onConfirm={resumeRecovered}
          onCancel={() => setRecovered(null)}
        />
      )}
    </div>
  )
}

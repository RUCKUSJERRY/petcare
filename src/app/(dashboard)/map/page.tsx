'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { cn } from '@/lib/utils'

type CategoryKey = 'lost' | 'hospital' | 'cafe' | 'restaurant'

const CATEGORIES: {
  key: CategoryKey
  label: string
  icon: string
  keyword: string | null
  empty: string
}[] = [
  { key: 'lost', label: '실종', icon: '🐾', keyword: null, empty: '주변에 등록된 실종 신고가 없어요.' },
  { key: 'hospital', label: '동물병원', icon: '🏥', keyword: '동물병원', empty: '주변에서 동물병원을 찾지 못했어요.' },
  { key: 'cafe', label: '애견카페', icon: '☕', keyword: '애견카페', empty: '주변에서 애견카페를 찾지 못했어요.' },
  { key: 'restaurant', label: '동반식당', icon: '🍽️', keyword: '애견동반식당', empty: '주변에서 애견동반식당을 찾지 못했어요.' },
]

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function MapPage() {
  const supabase = createClient()
  const [category, setCategory] = useState<CategoryKey>('lost')
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const placesRef = useRef<any>(null)
  const infoRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  // 매 렌더마다 최신 category/state를 반영한 로더를 ref에 보관 → idle 리스너에서 호출
  const loadRef = useRef<() => void>(() => {})

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    infoRef.current?.close()
  }

  const addMarker = (lat: number, lng: number, content: string) => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    const pos = new maps.LatLng(lat, lng)
    const marker = new maps.Marker({ position: pos, map })
    maps.event.addListener(marker, 'click', () => {
      infoRef.current.setContent(content)
      infoRef.current.open(map, marker)
    })
    markersRef.current.push(marker)
    return pos
  }

  // 항상 최신 category를 보는 로더 (idle/카테고리 변경에서 공통 호출)
  loadRef.current = () => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    if (!maps || !map) return
    clearMarkers()
    const cat = CATEGORIES.find(c => c.key === category)!

    if (cat.keyword === null) {
      // 실종: 우리 DB의 active 신고 전체
      setLoading(true)
      supabase
        .from('lost_pets')
        .select('id,name,species,area_text,lat,lng')
        .eq('status', 'active')
        .then(({ data }) => {
          setLoading(false)
          const items = (data ?? []) as any[]
          setCount(items.length)
          items.forEach(it => {
            const name = escapeHtml(it.name ?? '이름 미상')
            const area = it.area_text ? escapeHtml(it.area_text) : ''
            const content =
              `<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:140px;">` +
              `<b>${it.species === 'cat' ? '🐱' : '🐶'} ${name}</b>` +
              (area ? `<br/><span style="color:#888;">${area}</span>` : '') +
              `<br/><a href="/lost/${it.id}" style="color:#2d8a42;font-weight:600;">상세보기 →</a></div>`
            addMarker(it.lat, it.lng, content)
          })
        })
      return
    }

    // 병원/카페/식당: 카카오 장소검색 (지도 중심 반경 5km)
    const places = placesRef.current
    if (!places) return
    setLoading(true)
    places.keywordSearch(
      cat.keyword,
      (res: any[], status: string) => {
        setLoading(false)
        if (status !== maps.services.Status.OK || !res || res.length === 0) {
          setCount(0)
          return
        }
        setCount(res.length)
        res.forEach(p => {
          const name = escapeHtml(p.place_name)
          const addr = escapeHtml(p.road_address_name || p.address_name || '')
          const dist = p.distance ? `${(Number(p.distance) / 1000).toFixed(1)}km` : ''
          const dir = `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`
          const content =
            `<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:150px;">` +
            `<b>${name}</b>${dist ? ` <span style="color:#2d8a42;">${dist}</span>` : ''}` +
            (addr ? `<br/><span style="color:#888;">${addr}</span>` : '') +
            (p.phone ? `<br/><span style="color:#888;">${escapeHtml(p.phone)}</span>` : '') +
            `<br/><a href="${p.place_url}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">상세</a>` +
            ` · <a href="${dir}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">길찾기</a></div>`
          addMarker(Number(p.y), Number(p.x), content)
        })
      },
      { location: map.getCenter(), radius: 5000, sort: maps.services.SortBy.DISTANCE }
    )
  }

  // 지도 초기화 (1회)
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const seoul = new maps.LatLng(37.5665, 126.978)
    const map = new maps.Map(el, { center: seoul, level: 5 })
    mapsRef.current = maps
    mapObjRef.current = map
    placesRef.current = new maps.services.Places()
    infoRef.current = new maps.InfoWindow({ removable: true })

    // 지도 이동/줌이 멈추면 현재 카테고리 기준으로 다시 로드
    maps.event.addListener(map, 'idle', () => loadRef.current())

    // 현재 위치로 이동 (idle 이벤트가 자동으로 로더 호출)
    navigator.geolocation?.getCurrentPosition(
      p => map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude)),
      () => loadRef.current(),
      { timeout: 4000 }
    )
    // 위치 권한 대기 중에도 초기 1회 로드
    loadRef.current()
  }, [])

  // 카테고리 변경 시 즉시 재로드
  useEffect(() => {
    loadRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const notice = kakaoNotice(mapStatus)
  const activeEmpty = CATEGORIES.find(c => c.key === category)!.empty

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">지도</h1>
        {category === 'lost' && (
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/lost" className="btn-secondary text-sm py-1.5 px-3">목록</Link>
            <Link href="/lost/new" className="btn-primary text-sm py-1.5 px-3">+ 제보</Link>
          </div>
        )}
      </div>

      {/* 카테고리 토글 */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border shrink-0 transition-colors',
              category === c.key
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            )}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
          {notice}
        </div>
      ) : (
        <>
          <div
            ref={mapRef}
            className="w-full h-[60vh] min-h-80 rounded-2xl border border-gray-200 overflow-hidden bg-gray-100"
          />
          <p className="text-xs text-gray-400">
            {loading
              ? '불러오는 중…'
              : count === 0
                ? activeEmpty
                : count != null
                  ? category === 'lost'
                    ? `실종 신고 ${count}건`
                    : `주변 ${count}곳 · 지도를 움직이면 그 위치 기준으로 다시 검색돼요`
                  : '지도를 움직여 주변 정보를 확인하세요.'}
          </p>
        </>
      )}
    </div>
  )
}

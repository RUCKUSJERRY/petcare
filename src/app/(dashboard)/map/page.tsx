'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { cn } from '@/lib/utils'
import type { MapFavorite } from '@/types'

type CategoryKey = 'lost' | 'hospital' | 'cafe' | 'restaurant' | 'favorite'

// 동물병원 특화 진료/시설 빠른 필터 (카카오 키워드 검색에 덧붙임)
const HOSPITAL_TAGS = ['24시', '응급', '안과', '치과', '피부', '정형외과', '내과', '한방']

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

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
  { key: 'favorite', label: '즐겨찾기', icon: '⭐', keyword: '__fav__', empty: '저장한 즐겨찾기가 없어요. 장소를 선택해 ☆를 눌러보세요.' },
]

// 하단 리스트/시트용 정규화 아이템
type ListItem = {
  key: string
  kind: 'lost' | 'place' | 'fav'
  title: string
  subtitle: string
  phone?: string
  dist?: string
  url?: string         // 상세 (lost: 내부 상세, place/fav: 카카오맵)
  lat: number
  lng: number
  placeId?: string     // place/fav 식별자 (즐겨찾기 토글)
  species?: string
  emoji: string
  raw?: { place_name: string; address: string; phone: string; url: string; category: CategoryKey }
}

// 클라이언트 세션 동안 마지막 지도 위치를 기억(모듈 스코프).
let lastMapState: { lat: number; lng: number; level: number } | null = null

export default function MapPage() {
  const supabase = createClient()
  const [category, setCategory] = useState<CategoryKey>('lost')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<MapFavorite[]>([])
  const [selected, setSelected] = useState<ListItem | null>(null) // 하단 상세 시트
  const [listOpen, setListOpen] = useState(false)                 // 목록 시트 펼침
  const [needsResearch, setNeedsResearch] = useState(false)       // 지도 이동 후 '이 지역 재검색' 노출
  const userIdRef = useRef<string | null>(null)

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const placesRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const labelsRef = useRef<Map<string, any>>(new Map())  // 마커 상호명 라벨(CustomOverlay)
  const mapElRef = useRef<HTMLElement | null>(null) // 지도 컨테이너 DOM (높이 계산용)

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current.clear()
    labelsRef.current.forEach(l => l.setMap(null))
    labelsRef.current.clear()
  }

  // 핀이 하단 시트에 가리지 않도록 마커를 화면 상단 1/3 지점으로 이동
  const panMarkerAboveSheet = (lat: number, lng: number) => {
    const map = mapObjRef.current
    const maps = mapsRef.current
    if (!map || !maps) return
    try {
      const el = mapElRef.current
      const h = el?.clientHeight ?? 480
      const bounds = map.getBounds()
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      const latPerPx = (ne.getLat() - sw.getLat()) / h
      // 마커를 화면 상단 30% 위치로 → 중심보다 (h/2 - 0.3h) = 0.2h 위에.
      // 마커를 위로 올리려면 중심을 그만큼 남쪽으로.
      const d = h * 0.2
      map.panTo(new maps.LatLng(lat - d * latPerPx, lng))
    } catch {
      map.panTo(new maps.LatLng(lat, lng))
    }
  }

  const select = (item: ListItem) => {
    // 목록 펼침 상태(listOpen)는 유지한다. 상세 시트는 목록 위에 겹쳐 뜨고,
    // 상세를 닫으면 이전에 펼쳐둔 목록이 그대로 보이도록 함.
    setSelected(item)
    panMarkerAboveSheet(item.lat, item.lng)
  }

  const addMarker = (item: ListItem) => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    const pos = new maps.LatLng(item.lat, item.lng)
    const marker = new maps.Marker({ position: pos, map })
    maps.event.addListener(marker, 'click', () => select(item))
    markersRef.current.set(item.key, marker)

    // 핀 아래 상호명 라벨 (네이버지도처럼) — 클릭 시 상세 선택
    const label = new maps.CustomOverlay({
      position: pos,
      yAnchor: 0,           // 라벨 상단을 핀 위치에 맞춰 마커 아래로 배치
      zIndex: 1,
      content: `<div style="margin-top:2px;max-width:120px;padding:2px 6px;border-radius:9999px;background:rgba(255,255,255,0.95);box-shadow:0 1px 3px rgba(0,0,0,0.2);font-size:11px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.title)}</div>`,
    })
    label.setMap(map)
    labelsRef.current.set(item.key, label)
  }

  const loadFavorites = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    const { data } = await supabase
      .from('map_favorites')
      .select('*')
      .order('created_at', { ascending: false })
    const favs = (data ?? []) as MapFavorite[]
    setFavorites(favs)
    setFavIds(new Set(favs.map(f => f.place_id)))
  }, [supabase])

  // 최신 상태를 반영하는 로더 (idle/카테고리/검색에서 공통 호출)
  const loadRef = useRef<() => void>(() => {})
  loadRef.current = () => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    if (!maps || !map) return
    setNeedsResearch(false)
    clearMarkers()
    const cat = CATEGORIES.find(c => c.key === category)!

    // 실종: 우리 DB의 active 신고 전체
    if (cat.key === 'lost') {
      setLoading(true)
      supabase
        .from('lost_pets')
        .select('id,name,species,area_text,lat,lng')
        .eq('status', 'active')
        .then(({ data }) => {
          setLoading(false)
          const rows = (data ?? []) as any[]
          const list: ListItem[] = rows.map(it => ({
            key: it.id, kind: 'lost' as const,
            title: it.name ?? '이름 미상',
            subtitle: it.area_text || (it.species === 'cat' ? '고양이' : '강아지'),
            lat: it.lat, lng: it.lng, emoji: it.species === 'cat' ? '🐱' : '🐶',
            species: it.species, url: `/lost/${it.id}`,
          }))
          list.forEach(addMarker)
          setItems(list)
        })
      return
    }

    // 즐겨찾기: 저장된 장소
    if (cat.key === 'favorite') {
      const list: ListItem[] = favorites.map(f => ({
        key: f.place_id, kind: 'fav' as const, placeId: f.place_id,
        title: f.place_name, subtitle: f.address ?? '',
        phone: f.phone ?? undefined, url: f.place_url ?? undefined,
        lat: f.lat, lng: f.lng, emoji: '⭐',
      }))
      list.forEach(addMarker)
      setItems(list)
      return
    }

    // 병원/카페/식당: 카카오 장소검색 (지도 중심 반경 5km)
    const places = placesRef.current
    if (!places) return
    const kw = appliedKeyword.trim()
    const searchTerm = kw ? `${cat.keyword} ${kw}` : cat.keyword!
    setLoading(true)
    places.keywordSearch(
      searchTerm,
      (res: any[], status: string) => {
        setLoading(false)
        if (status !== maps.services.Status.OK || !res || res.length === 0) {
          setItems([])
          return
        }
        const list: ListItem[] = res.map(p => {
          const addr = p.road_address_name || p.address_name || ''
          const dist = p.distance ? `${(Number(p.distance) / 1000).toFixed(1)}km` : ''
          return {
            key: p.id, kind: 'place' as const, placeId: p.id,
            title: p.place_name, subtitle: addr,
            phone: p.phone || undefined, dist, url: p.place_url,
            lat: Number(p.y), lng: Number(p.x), emoji: cat.icon,
            raw: { place_name: p.place_name, address: addr, phone: p.phone || '', url: p.place_url, category: cat.key },
          }
        })
        list.forEach(addMarker)
        setItems(list)
      },
      { location: map.getCenter(), radius: 5000, sort: maps.services.SortBy.DISTANCE }
    )
  }

  // 즐겨찾기 토글
  const toggleFav = async (it: ListItem) => {
    const uid = userIdRef.current
    if (!uid || !it.placeId) return
    if (favIds.has(it.placeId)) {
      await supabase.from('map_favorites').delete().eq('user_id', uid).eq('place_id', it.placeId)
      setFavIds(prev => { const n = new Set(prev); n.delete(it.placeId!); return n })
      setFavorites(prev => prev.filter(f => f.place_id !== it.placeId))
      if (category === 'favorite') { setSelected(null); loadRef.current() }
    } else if (it.raw) {
      const { error } = await supabase.from('map_favorites').insert({
        user_id: uid,
        place_id: it.placeId,
        place_name: it.raw.place_name,
        category: it.raw.category,
        address: it.raw.address || null,
        phone: it.raw.phone || null,
        lat: it.lat,
        lng: it.lng,
        place_url: it.raw.url || null,
      })
      if (!error) {
        setFavIds(prev => new Set(prev).add(it.placeId!))
        loadFavorites()
      }
    }
  }

  // 사용자가 지도를 움직였을 때(드래그/줌) — 장소 카테고리면 '이 지역 재검색' 노출.
  // (프로그램 panTo는 dragend/zoom_changed를 발생시키지 않아 핀 선택 시엔 뜨지 않음)
  const onUserMoveRef = useRef<() => void>(() => {})
  onUserMoveRef.current = () => {
    if (category === 'hospital' || category === 'cafe' || category === 'restaurant') {
      setNeedsResearch(true)
    }
  }

  // 지도 초기화 (1회)
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    mapElRef.current = el
    const start = lastMapState
      ? new maps.LatLng(lastMapState.lat, lastMapState.lng)
      : new maps.LatLng(37.5665, 126.978)
    const map = new maps.Map(el, { center: start, level: lastMapState?.level ?? 5 })
    mapsRef.current = maps
    mapObjRef.current = map
    placesRef.current = new maps.services.Places()

    // idle: 세션 위치만 저장 (자동 재검색은 하지 않음 → 카카오 쿼터 절약)
    maps.event.addListener(map, 'idle', () => {
      const c = map.getCenter()
      lastMapState = { lat: c.getLat(), lng: c.getLng(), level: map.getLevel() }
    })
    maps.event.addListener(map, 'dragend', () => onUserMoveRef.current())
    maps.event.addListener(map, 'zoom_changed', () => onUserMoveRef.current())

    if (!lastMapState) {
      navigator.geolocation?.getCurrentPosition(
        p => {
          map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude))
          loadRef.current() // 현재 위치 확정 후 그 지역으로 재검색
        },
        () => loadRef.current(),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
      )
    }
    loadRef.current()
  }, [])

  // 사용자 + 즐겨찾기 초기 로드
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      userIdRef.current = user?.id ?? null
      if (user) loadFavorites()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 카테고리/검색어 변경 시 재로드
  useEffect(() => {
    setItems([])
    setSelected(null)
    loadRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, appliedKeyword])

  // 즐겨찾기 데이터 변동 시 현재 즐겨찾기 탭이면 갱신
  useEffect(() => {
    if (category === 'favorite') loadRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites])

  const notice = kakaoNotice(mapStatus)
  const activeCat = CATEGORIES.find(c => c.key === category)!
  const showSearch = category !== 'lost' && category !== 'favorite'

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keyword)
  }

  return (
    // 헤더(아래)·하단 네비(위) 사이를 가득 채우는 전체화면 지도 영역
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg top-[52px] bottom-[62px] z-30 bg-gray-100 overflow-hidden">
      {/* 지도 */}
      <div ref={mapRef} className="absolute inset-0" />

      {notice && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/90 p-6 text-center text-sm text-gray-500 max-w-xs">
            {notice}
          </div>
        </div>
      )}

      {/* ── 상단 오버레이: 검색 + 필터 ── */}
      <div className="absolute top-0 inset-x-0 z-20 px-3 pt-3 space-y-2 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          {showSearch ? (
            <form onSubmit={submitSearch} className="flex gap-2 flex-1">
              <div className="flex items-center flex-1 bg-white rounded-full shadow-md border border-gray-100 pl-3 pr-1">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  className="flex-1 bg-transparent px-2 py-2.5 text-sm focus:outline-none"
                  placeholder={`${activeCat.label} 내 검색 (예: 응급실, 24시)`}
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
                {appliedKeyword && (
                  <button type="button" onClick={() => { setKeyword(''); setAppliedKeyword('') }}
                    className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 shrink-0" aria-label="검색 초기화">✕</button>
                )}
                <button type="submit" className="bg-primary-500 text-white text-sm font-medium rounded-full px-3 py-1.5 shrink-0">검색</button>
              </div>
            </form>
          ) : (
            <div className="flex-1" />
          )}
          {category === 'lost' && (
            <Link href="/lost/new" className="bg-primary-500 text-white text-sm font-medium rounded-full px-3.5 py-2.5 shadow-md shrink-0 pointer-events-auto">
              + 제보
            </Link>
          )}
        </div>

        {/* 카테고리 필터 (지도 위, 가로 스크롤) */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key); setKeyword(''); setAppliedKeyword('') }}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium shrink-0 shadow-md border transition-colors',
                category === c.key
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-700 border-gray-100'
              )}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* 동물병원 특화 빠른 필터 (응급/24시·안과·치과 등) */}
        {category === 'hospital' && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto">
            {HOSPITAL_TAGS.map(tag => {
              const active = appliedKeyword === tag
              return (
                <button
                  key={tag}
                  onClick={() => {
                    const next = active ? '' : tag
                    setKeyword(next)
                    setAppliedKeyword(next)
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium shrink-0 shadow-sm border transition-colors',
                    active
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white/95 text-gray-600 border-gray-100'
                  )}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        )}

        {/* 지도 이동 후 이 지역 재검색 */}
        {needsResearch && !selected && (
          <div className="flex justify-center pointer-events-auto pt-0.5">
            <button
              onClick={() => loadRef.current()}
              className="flex items-center gap-1.5 bg-white text-primary-600 text-sm font-semibold rounded-full px-4 py-2 shadow-md border border-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              이 지역에서 재검색
            </button>
          </div>
        )}
      </div>

      {/* ── 현재 위치 버튼 ── */}
      {!notice && (
        <button
          onClick={() => {
            navigator.geolocation?.getCurrentPosition(
              p => {
                mapObjRef.current?.panTo(new mapsRef.current.LatLng(p.coords.latitude, p.coords.longitude))
                onUserMoveRef.current() // 이동한 위치에서 재검색 버튼 노출
              },
              undefined,
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            )
          }}
          className={cn(
            'absolute right-3 z-20 w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 transition-all',
            selected ? 'bottom-[44vh]' : 'bottom-24'
          )}
          aria-label="현재 위치로"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}

      {/* ── 산책 기록 바로가기 (지도에서 산책 진입) ── */}
      {!notice && !selected && (
        <Link
          href="/walks"
          className="absolute left-3 bottom-24 z-20 flex items-center gap-1.5 rounded-full bg-primary-500 text-white text-sm font-semibold pl-3 pr-4 py-2.5 shadow-md"
        >
          <span aria-hidden>🦮</span> 산책 기록
        </Link>
      )}

      {/* ── 하단: 상세 시트(선택 시) 또는 목록 시트 ── */}
      {!notice && (
        selected ? (
          <DetailSheet
            item={selected}
            isFav={!!selected.placeId && favIds.has(selected.placeId)}
            onClose={() => setSelected(null)}
            onToggleFav={() => toggleFav(selected)}
          />
        ) : (
          <ListSheet
            items={items}
            loading={loading}
            emptyText={activeCat.empty}
            countLabel={
              category === 'lost' ? `실종 신고 ${items.length}건`
                : category === 'favorite' ? `즐겨찾기 ${items.length}곳`
                  : `주변 ${items.length}곳`
            }
            open={listOpen}
            onToggle={() => setListOpen(o => !o)}
            onSelect={select}
          />
        )
      )}
    </div>
  )
}

/* ─────────── 하단 목록 시트 (접기/펼치기) ─────────── */
function ListSheet({
  items, loading, emptyText, countLabel, open, onToggle, onSelect,
}: {
  items: ListItem[]
  loading: boolean
  emptyText: string
  countLabel: string
  open: boolean
  onToggle: () => void
  onSelect: (it: ListItem) => void
}) {
  return (
    <div className="absolute bottom-0 inset-x-0 z-20 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
      <button onClick={onToggle} className="w-full flex flex-col items-center pt-2 pb-2">
        <span className="w-10 h-1 rounded-full bg-gray-300 mb-2" />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          {loading ? '불러오는 중…' : countLabel}
          <span className="text-gray-400">{open ? '▼' : '▲'}</span>
        </span>
      </button>

      {open && (
        <div className="max-h-[42vh] overflow-y-auto px-3 pb-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">{loading ? '' : emptyText}</p>
          ) : (
            items.map(it => (
              <button
                key={it.key}
                onClick={() => onSelect(it)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50"
              >
                <span className="text-xl shrink-0" aria-hidden>{it.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-gray-900 truncate">{it.title}</span>
                    {it.dist && <span className="text-xs text-primary-600 shrink-0">{it.dist}</span>}
                  </div>
                  {it.subtitle && <p className="text-xs text-gray-500 truncate">{it.subtitle}</p>}
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────── 하단 상세 시트 (핀/항목 선택 시, 드래그·X로 닫기) ─────────── */
function DetailSheet({
  item, isFav, onClose, onToggleFav,
}: {
  item: ListItem
  isFav: boolean
  onClose: () => void
  onToggleFav: () => void
}) {
  const [dy, setDy] = useState(0)
  const startRef = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = e.clientY
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startRef.current == null) return
    setDy(Math.max(0, e.clientY - startRef.current))
  }
  const onPointerEnd = () => {
    if (startRef.current == null) return
    if (dy > 70) onClose()
    setDy(0)
    startRef.current = null
  }

  const dirUrl = `https://map.kakao.com/link/to/${encodeURIComponent(item.title)},${item.lat},${item.lng}`
  const isPlace = item.kind !== 'lost'

  return (
    <div
      className="absolute bottom-0 inset-x-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
      style={{ transform: `translateY(${dy}px)`, transition: startRef.current == null ? 'transform 0.2s ease' : 'none' }}
    >
      {/* 드래그 핸들 + 닫기 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
      >
        <span className="block w-10 h-1 rounded-full bg-gray-300 mx-auto" />
        <button onClick={onClose} aria-label="닫기"
          className="absolute right-3 top-2 w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">✕</button>
      </div>

      <div className="px-4 pb-5 pt-1 space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-2xl shrink-0" aria-hidden>{item.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 truncate">{item.title}</h2>
              {item.dist && <span className="text-sm text-primary-600 font-medium shrink-0">{item.dist}</span>}
            </div>
            {item.subtitle && <p className="text-sm text-gray-500 mt-0.5">{item.subtitle}</p>}
            {item.phone && <p className="text-sm text-gray-500 mt-0.5">{item.phone}</p>}
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="grid grid-cols-2 gap-2">
          {item.kind === 'lost' ? (
            <Link href={item.url ?? '#'} className="col-span-2 btn-primary text-center py-2.5 text-sm">
              실종 상세보기 →
            </Link>
          ) : (
            <>
              {item.phone ? (
                <a href={`tel:${item.phone}`} className="btn-secondary text-center py-2.5 text-sm flex items-center justify-center gap-1.5">
                  📞 전화
                </a>
              ) : (
                <span className="rounded-lg border border-gray-100 bg-gray-50 text-gray-300 text-center py-2.5 text-sm flex items-center justify-center gap-1.5">📞 전화</span>
              )}
              <a href={dirUrl} target="_blank" rel="noopener" className="btn-secondary text-center py-2.5 text-sm flex items-center justify-center gap-1.5">
                🧭 길찾기
              </a>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener" className="btn-secondary text-center py-2.5 text-sm flex items-center justify-center gap-1.5">
                  ℹ️ 카카오맵 상세
                </a>
              )}
              {isPlace && (item.placeId || isFav) && (
                <button onClick={onToggleFav}
                  className={cn(
                    'rounded-lg border py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                    isFav ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}>
                  {isFav ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

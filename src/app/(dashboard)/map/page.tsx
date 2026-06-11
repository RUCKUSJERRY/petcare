'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { cn } from '@/lib/utils'
import type { MapFavorite } from '@/types'

type CategoryKey = 'lost' | 'hospital' | 'cafe' | 'restaurant' | 'favorite'

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
  { key: 'favorite', label: '즐겨찾기', icon: '⭐', keyword: '__fav__', empty: '저장한 즐겨찾기가 없어요. 장소 목록의 ☆를 눌러 추가해보세요.' },
]

// 하단 리스트용 정규화 아이템
type ListItem = {
  key: string
  kind: 'lost' | 'place' | 'fav'
  title: string
  subtitle: string
  phone?: string
  dist?: string
  url?: string         // 카카오맵 상세
  lat: number
  lng: number
  placeId?: string     // place/fav 식별자 (즐겨찾기 토글)
  emoji: string
  // 즐겨찾기 저장에 필요한 원본 정보
  raw?: { place_name: string; address: string; phone: string; url: string; category: CategoryKey }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function MapPage() {
  const supabase = createClient()
  const [category, setCategory] = useState<CategoryKey>('lost')
  const [keyword, setKeyword] = useState('')        // 검색 입력값
  const [appliedKeyword, setAppliedKeyword] = useState('') // 실제 적용된 검색어
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<MapFavorite[]>([])
  const userIdRef = useRef<string | null>(null)

  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const placesRef = useRef<any>(null)
  const infoRef = useRef<any>(null)
  const markersRef = useRef<Map<string, { marker: any; pos: any; content: string }>>(new Map())
  const pendingFocusRef = useRef<string | null>(null)
  const loadRef = useRef<() => void>(() => {})

  const clearMarkers = () => {
    markersRef.current.forEach(({ marker }) => marker.setMap(null))
    markersRef.current.clear()
    infoRef.current?.close()
  }

  const addMarker = (key: string, lat: number, lng: number, content: string) => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    const pos = new maps.LatLng(lat, lng)
    const marker = new maps.Marker({ position: pos, map })
    maps.event.addListener(marker, 'click', () => {
      infoRef.current.setContent(content)
      infoRef.current.open(map, marker)
    })
    markersRef.current.set(key, { marker, pos, content })
  }

  // 마커 렌더가 끝난 뒤, 리스트에서 누른 항목이 있으면 해당 팝업 자동 오픈
  const openPending = () => {
    const key = pendingFocusRef.current
    if (!key) return
    const entry = markersRef.current.get(key)
    if (entry) {
      infoRef.current.setContent(entry.content)
      infoRef.current.open(mapObjRef.current, entry.marker)
      pendingFocusRef.current = null
    }
  }

  // 즐겨찾기 로드
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
  loadRef.current = () => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    if (!maps || !map) return
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
          const list: ListItem[] = rows.map(it => {
            const name = it.name ?? '이름 미상'
            const area = it.area_text ?? ''
            const content =
              `<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:140px;">` +
              `<b>${it.species === 'cat' ? '🐱' : '🐶'} ${escapeHtml(name)}</b>` +
              (area ? `<br/><span style="color:#888;">${escapeHtml(area)}</span>` : '') +
              `<br/><a href="/lost/${it.id}" style="color:#2d8a42;font-weight:600;">상세보기 →</a></div>`
            addMarker(it.id, it.lat, it.lng, content)
            return {
              key: it.id, kind: 'lost' as const,
              title: name, subtitle: area || (it.species === 'cat' ? '고양이' : '강아지'),
              lat: it.lat, lng: it.lng, emoji: it.species === 'cat' ? '🐱' : '🐶',
              url: `/lost/${it.id}`,
            }
          })
          setItems(list)
          openPending()
        })
      return
    }

    // 즐겨찾기: 저장된 장소를 지도/리스트로
    if (cat.key === 'favorite') {
      const list: ListItem[] = favorites.map(f => {
        const dir = `https://map.kakao.com/link/to/${encodeURIComponent(f.place_name)},${f.lat},${f.lng}`
        const content =
          `<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:150px;">` +
          `<b>${escapeHtml(f.place_name)}</b>` +
          (f.address ? `<br/><span style="color:#888;">${escapeHtml(f.address)}</span>` : '') +
          (f.phone ? `<br/><a href="tel:${escapeHtml(f.phone)}" style="color:#2d8a42;">📞 ${escapeHtml(f.phone)}</a>` : '') +
          (f.place_url ? `<br/><a href="${f.place_url}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">상세</a> · ` : '<br/>') +
          `<a href="${dir}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">길찾기</a></div>`
        addMarker(f.place_id, f.lat, f.lng, content)
        return {
          key: f.place_id, kind: 'fav' as const, placeId: f.place_id,
          title: f.place_name, subtitle: f.address ?? '',
          phone: f.phone ?? undefined, url: f.place_url ?? undefined,
          lat: f.lat, lng: f.lng, emoji: '⭐',
        }
      })
      setItems(list)
      openPending()
      return
    }

    // 병원/카페/식당: 카카오 장소검색 (지도 중심 반경 5km)
    const places = placesRef.current
    if (!places) return
    const searchTerm = appliedKeyword.trim() || cat.keyword!
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
          const dir = `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`
          const content =
            `<div style="padding:8px 10px;font-size:12px;line-height:1.5;min-width:150px;">` +
            `<b>${escapeHtml(p.place_name)}</b>${dist ? ` <span style="color:#2d8a42;">${dist}</span>` : ''}` +
            (addr ? `<br/><span style="color:#888;">${escapeHtml(addr)}</span>` : '') +
            (p.phone ? `<br/><a href="tel:${escapeHtml(p.phone)}" style="color:#2d8a42;">📞 ${escapeHtml(p.phone)}</a>` : '') +
            `<br/><a href="${p.place_url}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">상세</a>` +
            ` · <a href="${dir}" target="_blank" rel="noopener" style="color:#2d8a42;font-weight:600;">길찾기</a></div>`
          addMarker(p.id, Number(p.y), Number(p.x), content)
          return {
            key: p.id, kind: 'place' as const, placeId: p.id,
            title: p.place_name, subtitle: addr,
            phone: p.phone || undefined, dist, url: p.place_url,
            lat: Number(p.y), lng: Number(p.x), emoji: cat.icon,
            raw: { place_name: p.place_name, address: addr, phone: p.phone || '', url: p.place_url, category: cat.key },
          }
        })
        setItems(list)
        openPending()
      },
      { location: map.getCenter(), radius: 5000, sort: maps.services.SortBy.DISTANCE }
    )
  }

  // 리스트 항목 클릭 → 지도 이동 + 팝업
  // 이동(panTo)하면 idle → 재로드 → openPending 순으로 팝업이 열린다.
  // 이동이 거의 없어 idle이 안 뜨는 경우를 위해 폴백으로 직접 오픈을 시도.
  const focusItem = (it: ListItem) => {
    const map = mapObjRef.current
    const maps = mapsRef.current
    if (!map || !maps) return
    pendingFocusRef.current = it.key
    map.panTo(new maps.LatLng(it.lat, it.lng))
    setTimeout(() => openPending(), 350)
  }

  // 즐겨찾기 토글
  const toggleFav = async (it: ListItem) => {
    const uid = userIdRef.current
    if (!uid || !it.placeId) return
    if (favIds.has(it.placeId)) {
      await supabase.from('map_favorites').delete().eq('user_id', uid).eq('place_id', it.placeId)
      setFavIds(prev => { const n = new Set(prev); n.delete(it.placeId!); return n })
      setFavorites(prev => prev.filter(f => f.place_id !== it.placeId))
      // 즐겨찾기 화면에서 제거 시 마커도 갱신
      if (category === 'favorite') loadRef.current()
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

  // 지도 초기화 (1회)
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const seoul = new maps.LatLng(37.5665, 126.978)
    const map = new maps.Map(el, { center: seoul, level: 5 })
    mapsRef.current = maps
    mapObjRef.current = map
    placesRef.current = new maps.services.Places()
    infoRef.current = new maps.InfoWindow({ removable: true })

    maps.event.addListener(map, 'idle', () => loadRef.current())

    navigator.geolocation?.getCurrentPosition(
      p => map.setCenter(new maps.LatLng(p.coords.latitude, p.coords.longitude)),
      () => loadRef.current(),
      { timeout: 4000 }
    )
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

  // 카테고리/검색어 변경 시 즉시 재로드
  useEffect(() => {
    setItems([])
    loadRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, appliedKeyword])

  // 즐겨찾기 데이터가 바뀌고 현재 즐겨찾기 탭이면 다시 렌더
  useEffect(() => {
    if (category === 'favorite') loadRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites])

  const notice = kakaoNotice(mapStatus)
  const activeCat = CATEGORIES.find(c => c.key === category)!
  const showSearch = category !== 'lost' && category !== 'favorite'
  const isPlaceList = category !== 'lost'

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keyword)
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">지도</h1>
        {category === 'lost' && (
          <Link href="/lost/new" className="btn-primary text-sm py-1.5 px-3 shrink-0">+ 제보</Link>
        )}
      </div>

      {/* 카테고리 토글 */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); setKeyword(''); setAppliedKeyword('') }}
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

      {/* 검색 (장소 카테고리에서만) */}
      {showSearch && (
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={`${activeCat.label} 검색 (예: ${activeCat.keyword})`}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn-primary text-sm px-4 shrink-0">검색</button>
          {appliedKeyword && (
            <button type="button" onClick={() => { setKeyword(''); setAppliedKeyword('') }} className="btn-secondary text-sm px-3 shrink-0">
              초기화
            </button>
          )}
        </form>
      )}

      {notice ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
          {notice}
        </div>
      ) : (
        <>
          <div
            ref={mapRef}
            className="w-full h-[50vh] min-h-72 rounded-2xl border border-gray-200 overflow-hidden bg-gray-100"
          />
          <p className="text-xs text-gray-400">
            {loading
              ? '불러오는 중…'
              : items.length === 0
                ? activeCat.empty
                : category === 'lost'
                  ? `실종 신고 ${items.length}건`
                  : category === 'favorite'
                    ? `즐겨찾기 ${items.length}곳`
                    : `주변 ${items.length}곳 · 지도를 움직이면 그 위치 기준으로 다시 검색돼요`}
          </p>

          {/* 하단 리스트 (실종·장소·즐겨찾기 통일) */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.key} className="card flex items-center gap-3">
                  <button onClick={() => focusItem(it)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-xl shrink-0" aria-hidden>{it.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-900 truncate">{it.title}</span>
                        {it.dist && <span className="text-xs text-primary-600 shrink-0">{it.dist}</span>}
                      </div>
                      {it.subtitle && <p className="text-xs text-gray-500 truncate">{it.subtitle}</p>}
                    </div>
                  </button>

                  {/* 액션: 전화 / 상세·길찾기 / 즐겨찾기 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {it.phone && (
                      <a
                        href={`tel:${it.phone}`}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-primary-600 hover:bg-primary-50"
                        aria-label={`${it.title} 전화`}
                      >
                        📞
                      </a>
                    )}
                    {it.kind === 'lost' && it.url ? (
                      <Link href={it.url} className="text-xs text-primary-600 font-semibold px-2">상세</Link>
                    ) : isPlaceList && (
                      <button
                        onClick={() => toggleFav(it)}
                        className={cn(
                          'w-8 h-8 rounded-full border flex items-center justify-center transition-colors',
                          favIds.has(it.placeId ?? '')
                            ? 'border-amber-300 bg-amber-50 text-amber-500'
                            : 'border-gray-200 text-gray-300 hover:text-amber-400'
                        )}
                        aria-label="즐겨찾기"
                      >
                        {favIds.has(it.placeId ?? '') ? '★' : '☆'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

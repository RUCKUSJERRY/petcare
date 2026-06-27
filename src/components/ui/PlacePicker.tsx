'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { hasKakaoKey, loadKakaoMaps } from '@/lib/kakao'

export type PlaceValue = { name: string; lat: number | null; lng: number | null }

type KakaoPlace = {
  place_name: string
  road_address_name?: string
  address_name?: string
  x: string // lng
  y: string // lat
}

/**
 * 장소 입력 — 한 입력창에 타이핑하면 아래에 카카오 장소 추천이 떠서 고르기만 하면 된다.
 * (별도 검색 버튼/패널 없음) 카카오 키가 없으면 자유 텍스트 입력으로 동작.
 */
export function PlacePicker({
  value,
  onChange,
  placeholder = '장소 (병원·미용실 등, 선택)',
}: {
  value: PlaceValue
  onChange: (v: PlaceValue) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<KakaoPlace[]>([])
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const enabled = hasKakaoKey()

  // 바깥 클릭 시 추천 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 입력값이 바뀌면(추천 열림 상태) 디바운스 후 자동 검색
  useEffect(() => {
    if (!enabled || !open) return
    const q = value.name.trim()
    if (q.length < 2) { setResults([]); return }
    const id = setTimeout(async () => {
      setSearching(true)
      try {
        const maps = await loadKakaoMaps()
        const places = new maps.services.Places()
        places.keywordSearch(q, (data: KakaoPlace[], status: string) => {
          setSearching(false)
          setResults(status === maps.services.Status.OK ? data.slice(0, 8) : [])
        })
      } catch {
        setSearching(false)
        setResults([])
      }
    }, 300)
    return () => clearTimeout(id)
  }, [value.name, open, enabled])

  const pick = (p: KakaoPlace) => {
    onChange({ name: p.place_name, lat: parseFloat(p.y), lng: parseFloat(p.x) })
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={value.name}
        onChange={e => { onChange({ name: e.target.value, lat: null, lng: null }); setOpen(true) }}
        onFocus={() => { if (results.length) setOpen(true) }}
        autoComplete="off"
      />
      {value.lat != null && <p className="text-xs text-primary-600 mt-1">📍 좌표 저장됨</p>}
      {enabled && !value.name.trim() && (
        <p className="text-xs text-gray-400 mt-1">장소명을 입력하면 추천이 떠요.</p>
      )}

      {open && enabled && (searching || results.length > 0) && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-lg divide-y divide-gray-100">
          {searching && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-gray-400">검색 중…</li>
          )}
          {results.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                <p className="text-sm font-medium text-gray-900">{p.place_name}</p>
                <p className="text-xs text-gray-400 truncate">{p.road_address_name || p.address_name}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

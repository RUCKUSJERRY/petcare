'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
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
 * 장소 입력 — 카카오 장소검색(키워드)으로 상호명+좌표를 고른다.
 * 카카오 키가 없으면 자유 텍스트 입력으로 동작(좌표 없이 이름만 저장).
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KakaoPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enabled = hasKakaoKey()

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true); setError(null); setResults([])
    try {
      const maps = await loadKakaoMaps()
      const places = new maps.services.Places()
      places.keywordSearch(q, (data: KakaoPlace[], status: string) => {
        setSearching(false)
        if (status === maps.services.Status.OK) setResults(data)
        else if (status === maps.services.Status.ZERO_RESULT) setError('검색 결과가 없어요.')
        else setError('장소 검색에 실패했어요.')
      })
    } catch {
      setSearching(false)
      setError('지도를 불러오지 못했어요. 이름만 직접 입력해주세요.')
    }
  }

  const pick = (p: KakaoPlace) => {
    onChange({ name: p.place_name, lat: parseFloat(p.y), lng: parseFloat(p.x) })
    setOpen(false)
    setResults([])
    setQuery('')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={value.name}
          onChange={e => onChange({ name: e.target.value, lat: null, lng: null })}
        />
        {enabled && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="shrink-0 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            🔍 검색
          </button>
        )}
      </div>

      {value.lat != null && (
        <p className="text-xs text-primary-600">📍 좌표 저장됨</p>
      )}

      {open && enabled && (
        <div className="rounded-lg border border-gray-200 p-2 space-y-2 bg-gray-50">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="장소명 검색 (예: ○○동물병원)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              autoFocus
            />
            <button type="button" onClick={search} disabled={searching}
              className="shrink-0 btn-primary px-3 text-sm">
              {searching ? '검색 중…' : '검색'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 bg-white rounded-md border border-gray-100">
              {results.map((p, i) => (
                <li key={i}>
                  <button type="button" onClick={() => pick(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-900">{p.place_name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.road_address_name || p.address_name}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

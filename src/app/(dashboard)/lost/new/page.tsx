'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { MultiImagePicker } from '@/components/ui/MultiImagePicker'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import type { Species } from '@/types'

export default function NewLostPage() {
  const t = useTranslations('lostNew')
  const supabase = createClient()
  const router = useRouter()
  const qc = useQueryClient()
  const geocoderRef = useRef<any>(null)
  const mapsRef = useRef<any>(null)
  const mapObjRef = useRef<any>(null)
  const placeRef = useRef<(ll: any) => void>(() => {})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [areaText, setAreaText] = useState('')
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', species: 'dog' as Species, gender: '', lost_at: new Date().toISOString().slice(0, 10),
    description: '', contact: '', contact_public: true,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // 지도: 탭해서 위치 핀 지정 + 역지오코딩으로 지역명
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    const seoul = new maps.LatLng(37.5665, 126.978)
    const map = new maps.Map(el, { center: seoul, level: 5 })
    const marker = new maps.Marker({ position: seoul, map, draggable: true })
    geocoderRef.current = new maps.services.Geocoder()
    mapsRef.current = maps
    mapObjRef.current = map

    const place = (latlng: any) => {
      marker.setPosition(latlng)
      setPos({ lat: latlng.getLat(), lng: latlng.getLng() })
      geocoderRef.current.coord2RegionCode(latlng.getLng(), latlng.getLat(), (res: any[], status: string) => {
        if (status === maps.services.Status.OK) {
          const r = res.find(x => x.region_type === 'H') ?? res[0]
          if (r) setAreaText(`${r.region_2depth_name} ${r.region_3depth_name}`.trim())
        }
      })
    }
    placeRef.current = place
    maps.event.addListener(map, 'click', (e: any) => place(e.latLng))
    // 마커 드래그로도 위치 지정
    maps.event.addListener(marker, 'dragend', () => place(marker.getPosition()))

    navigator.geolocation?.getCurrentPosition(
      p => { const ll = new maps.LatLng(p.coords.latitude, p.coords.longitude); map.setCenter(ll); place(ll) },
      () => {},
      { timeout: 4000 }
    )
  }, [])

  // 주소/장소 검색 → 지도 이동 + 핀 지정
  const searchAddress = () => {
    const maps = mapsRef.current
    const map = mapObjRef.current
    const q = query.trim()
    if (!maps || !map || !q) return
    setSearchError(null)
    const places = new maps.services.Places()
    places.keywordSearch(q, (data: any[], status: string) => {
      if (status === maps.services.Status.OK && data.length > 0) {
        const ll = new maps.LatLng(Number(data[0].y), Number(data[0].x))
        map.setCenter(ll)
        map.setLevel(4)
        placeRef.current(ll)
      } else {
        setSearchError(t('searchNoResult'))
      }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pos) { setError(t('errorNoLocation')); return }
    setSaving(true); setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t('errorLoginRequired')); setSaving(false); return }
    const { data, error: insErr } = await supabase.from('lost_pets').insert({
      user_id: user.id,
      name: form.name.trim() || null,
      species: form.species,
      gender: form.gender || null,
      photo_url: photoUrls[0] ?? null,
      photo_urls: photoUrls.length ? photoUrls : null,
      lost_at: form.lost_at,
      lat: pos.lat, lng: pos.lng,
      area_text: areaText || null,
      description: form.description.trim() || null,
      contact: form.contact.trim() || null,
      contact_public: form.contact_public,
    }).select('id').single()
    setSaving(false)
    if (insErr || !data) { setError(t('errorSubmitFailed')); return }
    qc.invalidateQueries({ queryKey: ['lost-pets'] })
    router.push(`/lost/${(data as { id: string }).id}`)
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('title')} fallbackHref="/lost" />

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">{t('photoLabel')}</label>
          <MultiImagePicker bucket="pet-photos" value={photoUrls} onChange={setPhotoUrls} onError={setError} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('nameLabel')}</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('namePlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('lostDateLabel')}</label>
            <input className="input" type="date" max={new Date().toISOString().slice(0, 10)}
              value={form.lost_at} onChange={e => set('lost_at', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('speciesLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['dog', 'cat'] as const).map(sp => (
                <button key={sp} type="button" onClick={() => set('species', sp)}
                  className={`py-2 rounded-lg border text-sm font-medium ${form.species === sp ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {sp === 'dog' ? t('speciesDog') : t('speciesCat')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('genderLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {['수컷', '암컷'].map(g => (
                <button key={g} type="button" onClick={() => set('gender', form.gender === g ? '' : g)}
                  className={`py-2 rounded-lg border text-sm font-medium ${form.gender === g ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 위치 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            {t('locationLabel')} {areaText && <span className="text-primary-600">· {areaText}</span>}
          </label>
          {kakaoNotice(mapStatus) ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-400">
              {kakaoNotice(mapStatus)}
            </div>
          ) : (
            <>
              {/* 주소/장소 검색 */}
              <div className="flex gap-2 mb-2">
                <input
                  className="input flex-1"
                  placeholder={t('searchPlaceholder')}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress() } }}
                />
                <button type="button" onClick={searchAddress} className="btn-secondary px-4 text-sm shrink-0">
                  {t('searchButton')}
                </button>
              </div>
              {searchError && <p className="text-xs text-red-500 mb-1">{searchError}</p>}
              <div ref={mapRef} className="w-full h-56 rounded-xl border border-gray-200 overflow-hidden bg-gray-100" />
              <p className="text-xs text-gray-400 mt-1">{t('mapHint')}</p>
            </>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('descriptionLabel')}</label>
          <textarea className="input min-h-20" value={form.description} onChange={e => set('description', e.target.value)}
            placeholder={t('descriptionPlaceholder')} />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">{t('contactLabel')}</label>
          <input className="input" value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="010-0000-0000" />
          <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.contact_public} onChange={e => set('contact_public', e.target.checked)} />
            {t('contactPublicConsent')}
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  )
}

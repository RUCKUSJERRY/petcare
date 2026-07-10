'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useKakaoMap, kakaoNotice } from '@/hooks/useKakaoMap'
import { daysUntil, todayKST } from '@/lib/utils'
import type { LostPet } from '@/types'

function dPlus(lostAt: string, t: (key: string, values?: Record<string, string | number | Date>) => string) {
  const d = -daysUntil(lostAt, todayKST()) // 과거일수록 양수 (경과일은 KST 오늘 기준)
  return d <= 0 ? t('today') : t('dPlus', { days: d })
}

export default function LostListPage() {
  const t = useTranslations('lost')
  const supabase = createClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['lost-pets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lost_pets')
        .select('*, breed:breeds(name_ko)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as LostPet[]
    },
  })

  // 지도 초기화 + 마커
  const { containerRef: mapRef, status: mapStatus } = useKakaoMap((maps, el) => {
    if (items.length === 0) return
    const center = new maps.LatLng(items[0].lat, items[0].lng)
    const map = new maps.Map(el, { center, level: 7 })
    const bounds = new maps.LatLngBounds()
    items.forEach(it => {
      const pos = new maps.LatLng(it.lat, it.lng)
      const marker = new maps.Marker({ position: pos, map })
      const iw = new maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;">${it.species === 'cat' ? '🐱' : '🐶'} ${it.name ?? t('mapUnknownName')} · ${it.area_text ?? ''}</div>`,
      })
      maps.event.addListener(marker, 'click', () => iw.open(map, marker))
      bounds.extend(pos)
    })
    map.setBounds(bounds)
  }, [items])

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('reportTitle')} fallbackHref="/map" />
        <Link href="/lost/new" className="btn-primary text-sm py-1.5 px-3 shrink-0">{t('reportButton')}</Link>
      </div>

      <SectionTabs section="map" />

      {/* 지도 */}
      {kakaoNotice(mapStatus) ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-400">
          {kakaoNotice(mapStatus)}
        </div>
      ) : (
        items.length > 0 && (
          <div ref={mapRef} className="w-full h-64 rounded-2xl border border-gray-200 overflow-hidden bg-gray-100" />
        )
      )}

      {/* 목록 */}
      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="🐾" title={t('emptyTitle')} hint={t('emptyHint')} />
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <Link key={it.id} href={`/lost/${it.id}`}>
              <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                  {it.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (it.species === 'cat' ? '🐱' : '🐶')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 truncate">{it.name ?? t('unknownName')}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold shrink-0">{dPlus(it.lost_at, t)}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {it.breed?.name_ko ?? (it.species === 'cat' ? t('speciesCat') : t('speciesDog'))}
                    {it.area_text ? ` · ${it.area_text}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('lostAtPrefix', { date: it.lost_at })}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

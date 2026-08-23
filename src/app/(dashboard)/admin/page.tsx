'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/pricing'

interface Stats {
  affiliateTotal: number
  affiliate7d: number
  subsActive: number
  subsCanceled: number
  subsPastDue: number
  paymentsCount: number
  revenue: number
  topProducts: { product_id: string; count: number }[]
  totalUsers: number
  newUsers7d: number
  newUsers30d: number
  premiumUsers: number
  conversionRate: number
  revenue30d: number
  payingUsers30d: number
  arppu: number
  arpu: number
  churnRate: number
  activeUsers1d: number
  activeUsers7d: number
  activeUsers30d: number
  stickiness: number
  recordingRate7d: number
  recordsPerActive7d: number
}

export default function AdminPage() {
  const t = useTranslations('admin')
  const router = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()

  const [price, setPrice] = useState('')
  const [ads, setAds] = useState(true)
  const [cooldown, setCooldown] = useState('3')
  const [upsellDismiss, setUpsellDismiss] = useState('1440')
  const [bannerDismiss, setBannerDismiss] = useState('1440')
  const [annivPush, setAnnivPush] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // 관리자 여부
  const { data: isAdmin, isLoading: checking } = useQuery<boolean>({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const { data } = await supabase.rpc('is_admin')
      return !!data
    },
  })

  // 설정값
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('key, value')
      return new Map((data ?? []).map(r => [r.key as string, r.value as string]))
    },
  })

  useEffect(() => {
    if (settings && !loaded) {
      setPrice(settings.get('premium_price_krw') ?? '3900')
      setAds(settings.get('ads_enabled') !== 'false')
      setCooldown(settings.get('ad_cooldown_min') ?? '3')
      setUpsellDismiss(settings.get('upsell_dismiss_min') ?? '1440')
      setBannerDismiss(settings.get('banner_dismiss_min') ?? '1440')
      setAnnivPush(settings.get('anniversary_push_active') !== 'false')
      setLoaded(true)
    }
  }, [settings, loaded])

  // 통계
  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    enabled: isAdmin === true,
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('failed')
      return res.json()
    },
  })

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(false)
    const n = parseInt(price.replace(/[^0-9]/g, ''), 10)
    const priceVal = Number.isFinite(n) && n > 0 ? String(n) : '3900'
    const nonNeg = (s: string, fallback: string) => {
      const v = parseInt(s.replace(/[^0-9]/g, ''), 10)
      return Number.isFinite(v) && v >= 0 ? String(v) : fallback
    }
    // 업서트 결과의 error 를 무시하고 항상 '저장됨'을 띄우던 문제가 있었다 — RLS 회귀·네트워크로
    // 저장이 거부돼도 관리자에겐 성공으로 보이고, 무효화된 쿼리는 예전 값만 다시 불러왔다.
    // 이제 error 를 확인해 실패 시 실패 상태를 표시하고, 캐시 무효화는 성공했을 때만 한다.
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'premium_price_krw', value: priceVal },
      { key: 'ads_enabled', value: ads ? 'true' : 'false' },
      { key: 'ad_cooldown_min', value: nonNeg(cooldown, '3') },
      { key: 'upsell_dismiss_min', value: nonNeg(upsellDismiss, '1440') },
      { key: 'banner_dismiss_min', value: nonNeg(bannerDismiss, '1440') },
      { key: 'anniversary_push_active', value: annivPush ? 'true' : 'false' },
    ], { onConflict: 'key' })
    setSaving(false)
    if (error) {
      setSaveError(true)
      return
    }
    setSaved(true)
    qc.invalidateQueries({ queryKey: ['app-settings'] })
    qc.invalidateQueries({ queryKey: ['admin-settings'] })
    setTimeout(() => setSaved(false), 2000)
  }

  if (checking) {
    return <div className="px-4 py-10 text-center text-gray-400">{t('loading')}</div>
  }
  if (!isAdmin) {
    return (
      <div className="px-4 py-16 text-center">
        <div className="text-4xl mb-3" aria-hidden>🔒</div>
        <p className="text-gray-500">{t('forbidden')}</p>
        <button onClick={() => router.replace('/dashboard')} className="mt-4 text-sm text-primary-600">
          {t('goHome')}
        </button>
      </div>
    )
  }

  const won = (n: number) => `₩${formatKRW(n)}`

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400" aria-label={t('back')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* 설정 */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-gray-900">{t('settings')}</h2>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">{t('priceLabel')}</label>
          <input
            className="input" type="number" min="0" inputMode="numeric"
            value={price} onChange={e => setPrice(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('priceHint')}</p>
        </div>
        <label className="flex items-center justify-between py-1">
          <span className="text-sm text-gray-700">{t('adsLabel')}</span>
          <input type="checkbox" checked={ads} onChange={e => setAds(e.target.checked)} className="w-5 h-5 accent-primary-500" />
        </label>
        <label className="flex items-center justify-between py-1">
          <div className="pr-3">
            <span className="text-sm text-gray-700">{t('annivPushLabel')}</span>
            <p className="text-[11px] text-gray-400 mt-0.5">{t('annivPushHint')}</p>
          </div>
          <input type="checkbox" checked={annivPush} onChange={e => setAnnivPush(e.target.checked)} className="w-5 h-5 accent-primary-500 shrink-0" />
        </label>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">{t('cooldownLabel')}</label>
          <input
            className="input" type="number" min="0" inputMode="numeric"
            value={cooldown} onChange={e => setCooldown(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('cooldownHint')}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">{t('upsellDismissLabel')}</label>
          <input
            className="input" type="number" min="0" inputMode="numeric"
            value={upsellDismiss} onChange={e => setUpsellDismiss(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('dismissHint')}</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">{t('bannerDismissLabel')}</label>
          <input
            className="input" type="number" min="0" inputMode="numeric"
            value={bannerDismiss} onChange={e => setBannerDismiss(e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">{t('dismissHint')}</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full py-3">
          {saving ? t('saving') : saved ? t('saved') : t('saveBtn')}
        </button>
        {saveError && (
          <p className="text-sm text-red-600 text-center" role="alert">{t('saveError')}</p>
        )}
      </section>

      {/* 핵심 지표 (투자자/운영용 KPI) */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">{t('kpi')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('totalUsers')} value={stats ? `${stats.totalUsers}` : '—'} accent />
          <StatCard label={t('premiumUsers')} value={stats ? `${stats.premiumUsers}` : '—'} />
          <StatCard label={t('conversionRate')} value={stats ? `${stats.conversionRate}%` : '—'} />
          <StatCard label={t('churnRate')} value={stats ? `${stats.churnRate}%` : '—'} />
          <StatCard label={t('newUsers')} value={stats ? `+${stats.newUsers7d} / +${stats.newUsers30d}` : '—'} />
          <StatCard label={t('mrr')} value={stats ? won(stats.revenue30d) : '—'} accent />
          <StatCard label={t('arppu')} value={stats ? won(stats.arppu) : '—'} />
          <StatCard label={t('arpu')} value={stats ? won(stats.arpu) : '—'} />
        </div>
      </section>

      {/* 리텐션 (기록 활동 기반) */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">{t('retention')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label={t('activeUsers')}
            value={stats ? `${stats.activeUsers1d} / ${stats.activeUsers7d} / ${stats.activeUsers30d}` : '—'}
            accent
          />
          <StatCard label={t('stickiness')} value={stats ? `${stats.stickiness}%` : '—'} />
          <StatCard label={t('recordingRate')} value={stats ? `${stats.recordingRate7d}%` : '—'} />
          <StatCard label={t('recordsPerActive')} value={stats ? `${stats.recordsPerActive7d}` : '—'} />
        </div>
        <p className="text-[11px] text-gray-400">{t('retentionHint')}</p>
      </section>

      {/* 통계 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">{t('stats')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('revenue')} value={stats ? won(stats.revenue) : '—'} accent />
          <StatCard label={t('paymentsCount')} value={stats ? `${stats.paymentsCount}` : '—'} />
          <StatCard label={t('subsActive')} value={stats ? `${stats.subsActive}` : '—'} />
          <StatCard label={t('subsOther')} value={stats ? `${stats.subsCanceled}/${stats.subsPastDue}` : '—'} />
          <StatCard label={t('affiliateTotal')} value={stats ? `${stats.affiliateTotal}` : '—'} />
          <StatCard label={t('affiliate7d')} value={stats ? `${stats.affiliate7d}` : '—'} />
        </div>

        {stats && stats.topProducts.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('topProducts')}</h3>
            <ul className="space-y-1">
              {stats.topProducts.map(p => (
                <li key={p.product_id} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate">{p.product_id}</span>
                  <span className="text-gray-400 tabular-nums shrink-0 ml-2">{t('clicks', { n: p.count })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${accent ? 'text-primary-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

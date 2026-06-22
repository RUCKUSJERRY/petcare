'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { usePlan } from '@/hooks/usePlan'

const PRICE = process.env.NEXT_PUBLIC_PREMIUM_PRICE_KRW || '3,900'

export default function PremiumPage() {
  const t = useTranslations('premium')
  const router = useRouter()
  const { isPremium, premiumUntil } = usePlan()
  const [notice, setNotice] = useState(false)

  // 혜택 목록: ready=현재 제공, 나머지는 준비 중
  const benefits: { icon: string; key: string; ready: boolean }[] = [
    { icon: '🚫', key: 'noAds', ready: true },
    { icon: '📊', key: 'reports', ready: false },
    { icon: '🧾', key: 'ocr', ready: false },
    { icon: '👨‍👩‍👧', key: 'family', ready: false },
  ]

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400" aria-label={t('back')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* 히어로 */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white text-center shadow-lg">
        <div className="text-5xl mb-2" aria-hidden>👑</div>
        <div className="text-lg font-bold">{t('heroTitle')}</div>
        <p className="mt-1 text-sm text-white/80">{t('heroSubtitle')}</p>
      </div>

      {/* 현재 상태 */}
      {isPremium ? (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {t('activeBadge')}
          {premiumUntil && (
            <span className="block text-xs text-green-600 mt-0.5">
              {t('activeUntil', { date: new Date(premiumUntil).toLocaleDateString('ko-KR') })}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-gray-500">{t('currentFree')}</p>
      )}

      {/* 혜택 */}
      <ul className="mt-5 space-y-2.5">
        {benefits.map(b => (
          <li key={b.key} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
            <span className="text-2xl shrink-0" aria-hidden>{b.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{t(`benefit.${b.key}.title`)}</div>
              <div className="text-xs text-gray-400">{t(`benefit.${b.key}.desc`)}</div>
            </div>
            {!b.ready && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
                {t('comingSoon')}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* 가격 + CTA */}
      {!isPremium && (
        <div className="mt-6 space-y-2">
          <div className="text-center">
            <span className="text-2xl font-bold text-gray-900">₩{PRICE}</span>
            <span className="text-sm text-gray-400"> {t('perMonth')}</span>
          </div>
          <button onClick={() => setNotice(true)} className="btn-primary w-full py-3.5 text-base font-semibold">
            {t('upgradeCta')}
          </button>
          {notice && (
            <p className="text-center text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t('paymentComingSoon')}
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">{t('disclaimer')}</p>
    </div>
  )
}

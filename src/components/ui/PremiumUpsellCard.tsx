'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePlan } from '@/hooks/usePlan'

const DISMISS_KEY = 'petcare:premiumUpsellDismiss'

/**
 * 대시보드용 프리미엄 업셀 카드. 무료 사용자에게만 노출하고, ✕로 닫으면 해당 세션 동안 숨긴다.
 * 마이페이지 외에 홈에서도 구독으로 진입할 수 있게 한다.
 */
export function PremiumUpsellCard() {
  const t = useTranslations('premium')
  const { isPremium } = usePlan()
  const [dismissed, setDismissed] = useState(true) // SSR 깜빡임 방지

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (isPremium || dismissed) return null

  const close = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <Link
      href="/premium"
      className="relative flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 px-4 py-3.5 text-white shadow-md hover:shadow-lg transition-shadow"
    >
      <span className="text-3xl shrink-0" aria-hidden>👑</span>
      <div className="flex-1 min-w-0 pr-5">
        <div className="text-sm font-bold">{t('upsellTitle')}</div>
        <div className="text-xs text-white/85 mt-0.5">{t('upsellDesc')}</div>
        <span className="inline-block mt-1.5 text-xs font-semibold underline underline-offset-2">
          {t('upsellCta')} →
        </span>
      </div>
      <button
        onClick={close}
        aria-label={t('upsellDismiss')}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-white/70 hover:bg-white/15"
      >
        ✕
      </button>
    </Link>
  )
}

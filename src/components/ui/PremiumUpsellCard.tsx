'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePlan } from '@/hooks/usePlan'
import { useAppSettings } from '@/hooks/useAppSettings'

const DISMISS_KEY = 'petcare:premiumUpsellDismissAt'

/** 닫은 지 cooldownMs 가 지나지 않았으면 true (계속 숨김). 0이면 항상 노출. */
function dismissedRecently(cooldownMs: number): boolean {
  if (typeof window === 'undefined' || cooldownMs <= 0) return false
  const raw = window.localStorage.getItem(DISMISS_KEY)
  const at = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(at) && Date.now() - at < cooldownMs
}

/**
 * 대시보드용 프리미엄 업셀 카드. 무료 사용자에게만 노출하고, ✕로 닫으면
 * 관리자가 정한 시간(분) 동안 숨겼다가 다시 노출한다. (localStorage 타임스탬프)
 */
export function PremiumUpsellCard() {
  const t = useTranslations('premium')
  const { isPremium } = usePlan()
  const { upsellDismissMs } = useAppSettings()
  const [dismissed, setDismissed] = useState(true) // SSR 깜빡임 방지

  useEffect(() => {
    setDismissed(dismissedRecently(upsellDismissMs))
  }, [upsellDismissMs])

  if (isPremium || dismissed) return null

  const close = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
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

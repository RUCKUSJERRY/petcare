'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useStickyBanner } from '@/contexts/StickyBannerContext'
import {
  buildAffiliateUrl,
  getAffiliateProducts,
  type AffiliateContext,
} from '@/lib/affiliate'
import type { Species } from '@/types'

/** 클릭을 best-effort 로 적재한다 (실패해도 사용자 흐름은 막지 않음). */
async function trackClick(productId: string, context: AffiliateContext) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('affiliate_clicks').insert({ user_id: user?.id ?? null, product_id: productId, context })
  } catch { /* 무시 */ }
}

/** 닫은 지 cooldownMs 가 지나지 않았으면 true (계속 숨김). 0이면 항상 노출. */
function dismissedRecently(key: string, cooldownMs: number): boolean {
  if (typeof window === 'undefined' || cooldownMs <= 0) return false
  const raw = window.localStorage.getItem(key)
  const at = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(at) && Date.now() - at < cooldownMs
}

/**
 * 하단 고정 제휴 배너. 한 개 상품을 화면 하단(내비게이션 위)에 띄우고 X로 닫는다.
 * 닫으면 관리자가 정한 시간(분) 동안 숨겼다가 다시 노출한다. (localStorage 타임스탬프)
 */
export function StickyAffiliateBanner({
  species,
  context,
}: {
  species: Species
  context: AffiliateContext
}) {
  const t = useTranslations('affiliate')
  const { bannerDismissMs } = useAppSettings()
  const { setVisible } = useStickyBanner()
  const [dismissed, setDismissed] = useState(true) // SSR 깜빡임 방지: 마운트 후 결정
  const key = `petcare:affDismissAt:${context}`

  useEffect(() => {
    setDismissed(dismissedRecently(key, bannerDismissMs))
  }, [key, bannerDismissMs])

  const products = getAffiliateProducts(species, context)
  const product = products[0]
  const visible = !!product && !dismissed

  // 배너가 실제로 화면에 뜨는지를 전역에 알려, FAB이 겹치지 않게 위로 올라가도록 한다.
  // 언마운트 시(화면 이동)엔 반드시 false 로 되돌려 다른 화면의 FAB 위치를 원복한다.
  useEffect(() => {
    setVisible(visible)
    return () => setVisible(false)
  }, [visible, setVisible])

  if (!product || dismissed) return null

  const close = () => { window.localStorage.setItem(key, String(Date.now())); setDismissed(true) }
  const onClick = () => {
    trackClick(product.id, context)
    window.open(buildAffiliateUrl(product.link), '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg px-3 z-40"
      style={{ bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
        <button onClick={onClick} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <span className="text-xl shrink-0" aria-hidden>{product.emoji}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-900 truncate">{product.title}</span>
            <span className="block text-[11px] text-gray-400 truncate">
              <span className="text-gray-300 mr-1">{t('adLabel')}</span>{product.desc}
            </span>
          </span>
          {product.priceText && <span className="text-xs font-semibold text-amber-600 shrink-0">{product.priceText}</span>}
        </button>
        <button
          onClick={close}
          aria-label={t('dismiss')}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

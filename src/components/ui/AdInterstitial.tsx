'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { AD_COUNTDOWN_SEC } from '@/lib/ads'
import { buildAffiliateUrl, getAdCreativeProduct } from '@/lib/affiliate'
import type { Species } from '@/types'

/**
 * 전면(리워드형) 광고 오버레이.
 * 카운트다운이 끝나면 "계속하기"로 원래 행동을 진행한다. 닫기(✕)는 행동을 취소한다.
 * 광고 소재는 자체/제휴 상품으로 채우며, 클릭 시 제휴 링크로 이동(클릭 적재).
 */
export function AdInterstitial({
  species,
  onComplete,
  onCancel,
}: {
  species?: Species
  onComplete: () => void
  onCancel: () => void
}) {
  const t = useTranslations('ads')
  const [left, setLeft] = useState(AD_COUNTDOWN_SEC)
  const product = useMemo(() => getAdCreativeProduct(species), [species])

  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft(n => n - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  const ready = left <= 0

  const onAdClick = () => {
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        supabase.from('affiliate_clicks').insert({
          user_id: user?.id ?? null, product_id: product.id, context: 'ad',
        })
      })
    } catch { /* 무시 */ }
    window.open(buildAffiliateUrl(product.link), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('title')}>
      {/* 상단 바: 광고 라벨 + 닫기 */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <span className="text-[11px] font-semibold tracking-wide text-white/70 bg-white/10 rounded px-2 py-1">
          {t('sponsored')}
        </span>
        <button
          onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/80 text-lg"
          aria-label={t('close')}
        >
          ✕
        </button>
      </div>

      {/* 광고 소재 */}
      <div className="flex-1 flex items-center justify-center px-6">
        <button
          onClick={onAdClick}
          className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl transition-transform active:scale-[0.98]"
        >
          <div className="text-6xl mb-4" aria-hidden>{product.emoji}</div>
          <div className="text-lg font-bold text-gray-900">{product.title}</div>
          <p className="mt-1.5 text-sm text-gray-500">{product.desc}</p>
          <span className="mt-5 inline-block rounded-full bg-primary-500 px-5 py-2 text-sm font-semibold text-white">
            {t('cta')}
          </span>
        </button>
      </div>

      {/* 하단: 카운트다운/계속 + 프리미엄 안내 */}
      <div className="px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 space-y-3">
        <button
          onClick={onComplete}
          disabled={!ready}
          className="w-full py-3.5 rounded-xl text-base font-semibold text-white bg-primary-600 disabled:bg-white/20 disabled:text-white/60 transition-colors"
        >
          {ready ? t('continue') : t('countdown', { sec: left })}
        </button>
        <Link
          href="/premium"
          onClick={onCancel}
          className="block text-center text-xs text-white/60 underline underline-offset-2"
        >
          {t('removeAds')}
        </Link>
      </div>
    </div>
  )
}

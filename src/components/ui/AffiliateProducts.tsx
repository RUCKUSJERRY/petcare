'use client'

import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
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
    await supabase.from('affiliate_clicks').insert({
      user_id: user?.id ?? null,
      product_id: productId,
      context,
    })
  } catch {
    /* 추적 실패는 무시 */
  }
}

/**
 * 추천 제휴 상품 목록. 사료 계산기·음식 가이드 등 맥락에 맞춰 노출한다.
 * 제휴(광고) 표기와 면책 고지를 함께 보여 준다.
 */
export function AffiliateProducts({
  species,
  context,
  className = '',
}: {
  species: Species
  context: AffiliateContext
  className?: string
}) {
  const t = useTranslations('affiliate')
  const products = getAffiliateProducts(species, context)
  if (products.length === 0) return null

  const onClick = (id: string, link: string) => {
    trackClick(id, context)
    window.open(buildAffiliateUrl(link), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className={`space-y-2 ${className}`} aria-label={t('heading')}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('heading')}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">
          {t('adLabel')}
        </span>
      </div>
      <div className="space-y-1.5">
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => onClick(p.id, p.link)}
            className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <span className="text-2xl shrink-0" aria-hidden>{p.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900 truncate">{p.title}</span>
              <span className="block text-xs text-gray-400 truncate">{p.desc}</span>
            </span>
            {p.priceText && (
              <span className="text-xs font-semibold text-amber-600 shrink-0">{p.priceText}</span>
            )}
            <span className="text-gray-300 shrink-0" aria-hidden>›</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 leading-relaxed">{t('disclosure')}</p>
    </section>
  )
}

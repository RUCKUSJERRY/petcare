'use client'

import { useTranslations } from 'next-intl'
import { buildAffiliateUrl, type SmartRec } from '@/lib/affiliate'
import { trackAffiliateClick } from './AffiliateProducts'

/**
 * 기록 기반 맞춤 제휴 추천 카드.
 * 임박한 케어 일정·식사 루틴 등 "지금 필요한" 소모품을 이유와 함께 보여 준다.
 * (추천 로직은 lib/affiliate 의 getSmartRecommendations 가 담당)
 */
export function SmartAffiliateCard({ recs }: { recs: SmartRec[] }) {
  const t = useTranslations('affiliate')
  if (recs.length === 0) return null

  const reasonOf = (rec: SmartRec): string => {
    if (rec.trigger.type === 'mealRoutine') return t('smartReasonMeal')
    const { category, daysUntil } = rec.trigger
    const dday = daysUntil <= 0 ? t('smartToday') : `D-${daysUntil}`
    return t('smartReasonCare', { category, dday })
  }

  const onClick = (id: string, link: string) => {
    trackAffiliateClick(id, 'smart')
    window.open(buildAffiliateUrl(link), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="space-y-2" aria-label={t('smartHeading')}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">✨ {t('smartHeading')}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">
          {t('adLabel')}
        </span>
      </div>
      <div className="space-y-1.5">
        {recs.map(rec => (
          <button
            key={rec.product.id}
            onClick={() => onClick(rec.product.id, rec.product.link)}
            className="w-full flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2.5 text-left transition-colors hover:bg-amber-50 active:bg-amber-100"
          >
            <span className="text-2xl shrink-0" aria-hidden>{rec.product.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-amber-700 truncate">{reasonOf(rec)}</span>
              <span className="block text-sm font-medium text-gray-900 truncate">{rec.product.title}</span>
            </span>
            <span className="text-gray-300 shrink-0" aria-hidden>›</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 leading-relaxed">{t('disclosure')}</p>
    </section>
  )
}

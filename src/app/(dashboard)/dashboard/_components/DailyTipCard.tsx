import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getDailyTip } from '@/lib/dailyTip'
import type { Species } from '@/types'

/**
 * 홈 '오늘의 케어 팁' 카드 (서버 렌더).
 * 날짜 기준으로 매일 바뀌는 짧은 관리 팁을 보여줘, 정보 화면 재방문·체류를 유도한다.
 * 팁을 누르면 관련 가이드(생활관리/음식) 화면으로 바로 진입한다.
 */
export async function DailyTipCard({
  species,
  dateStr,
}: {
  species: Species
  dateStr: string
}) {
  const tip = getDailyTip(species, dateStr)
  if (!tip) return null

  const t = await getTranslations('dailyTip')

  return (
    <Link href={tip.href} className="block">
      <div className="card border-l-4 border-primary-400 hover:shadow-md transition-shadow" style={{ borderRadius: '0 12px 12px 0' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-primary-600">{t('title')}</span>
          <span className="text-xs text-gray-400">{tip.category} ›</span>
        </div>
        <div className="flex gap-2.5">
          <span className="text-2xl shrink-0" aria-hidden>{tip.icon}</span>
          <p className="flex-1 text-sm text-gray-700 leading-relaxed">{tip.text}</p>
        </div>
      </div>
    </Link>
  )
}

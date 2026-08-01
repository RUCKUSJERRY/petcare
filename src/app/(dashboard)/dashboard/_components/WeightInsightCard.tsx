'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { computeWeightInsight } from '@/lib/weightInsight'
import type { WeightLog } from '@/types'

/**
 * 선택된 아이의 체중 추세 인사이트(대시보드용).
 * - 최근 추세(증가/감소/유지)와 주당 변화
 * - 목표 체중 도달 예상일(추세가 목표 방향일 때)
 * - 직전 대비 급변 경고
 * 체중 로그가 2건 미만이면 렌더링하지 않는다. WeightSection과 쿼리 키를 공유해 캐시를 재사용.
 */
export function WeightInsightCard({ petId }: { petId: string }) {
  const supabase = createClient()
  const t = useTranslations('weightInsight')

  const { data: logs = [] } = useQuery({
    queryKey: ['weight_logs', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('pet_id', petId)
        .order('measured_on', { ascending: true })
        // 같은 날 여러 번 잰 경우의 정렬 확정 (WeightSection·프로필 동기화와 동일 기준).
        .order('created_at', { ascending: true })
      return (data ?? []) as WeightLog[]
    },
  })

  const { data: target = null } = useQuery({
    queryKey: ['pet_target', petId],
    queryFn: async () => {
      const { data } = await supabase.from('pets').select('target_weight_kg').eq('id', petId).single()
      return (data?.target_weight_kg ?? null) as number | null
    },
  })

  if (logs.length < 2) return null

  const insight = computeWeightInsight(logs, target)
  const reached = insight.toGoal != null && Math.abs(insight.toGoal) < 0.05
  const pctText = (p: number) => Math.round(Math.abs(p) * 100)

  const trendLabel =
    insight.direction === 'up' ? t('trendUp') : insight.direction === 'down' ? t('trendDown') : t('trendFlat')
  const trendTone =
    insight.suddenChange ? 'text-red-600'
      : insight.direction === 'up' ? 'text-red-500'
      : insight.direction === 'down' ? 'text-blue-500'
      : 'text-gray-500'

  return (
    <Link
      href={`/pets/${petId}?add=weight`}
      className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span aria-hidden>⚖️</span>
        <span className="font-semibold text-gray-800 text-sm">{t('title')}</span>
        <span className={`text-xs font-semibold ml-auto ${trendTone}`}>
          {insight.direction === 'up' ? '▲' : insight.direction === 'down' ? '▼' : '–'} {trendLabel}
          {insight.trendPerWeek != null && insight.direction !== 'flat' && (
            <span className="text-gray-400 font-normal ml-1">
              ({t('perWeek', { kg: Math.abs(insight.trendPerWeek).toFixed(2) })})
            </span>
          )}
        </span>
      </div>

      {insight.suddenChange && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5 mt-1">
          ⚠️ {insight.suddenChange.up
            ? t('suddenUp', { pct: pctText(insight.suddenChange.pct) })
            : t('suddenDown', { pct: pctText(insight.suddenChange.pct) })}
        </p>
      )}

      {reached ? (
        <p className="text-xs text-green-600 font-medium mt-1">{t('reached')}</p>
      ) : insight.projectedGoalDate ? (
        <p className="text-xs text-gray-500 mt-1">🎯 {t('projected', { date: insight.projectedGoalDate })}</p>
      ) : null}
    </Link>
  )
}

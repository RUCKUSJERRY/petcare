'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { addDays, todayKST, careCategoryIcon } from '@/lib/utils'
import {
  computeLifePattern,
  PATTERN_CATEGORIES,
  PATTERN_WINDOW_DAYS,
  type CategoryPattern,
  type LogRecord,
} from '@/lib/recordStats'

/**
 * 선택된 아이의 '생활 패턴' 카드(대시보드용).
 * - 최근 14일 식사·물·배변 기록 추이(미니 막대)
 * - 개인 기준선(평소 하루 횟수) 대비 며칠째 공백이면 이상 신호 배너
 *
 * 매일 원탭으로 쌓이는 생활기록은 여태 '시간순 나열'로만 보였다 — 추이·공백으로 되살려
 * 건강 모니터링 + 재방문 계기로 쓴다. (체중 인사이트 카드와 같은 자리·같은 결)
 * 창 안에서 실제로 기록한 날이 적으면(신규/저활동) 스스로 숨는다.
 */
export function LifePatternCard({ petId }: { petId: string }) {
  const t = useTranslations('lifePattern')
  const supabase = createClient()
  const today = todayKST()
  const from = addDays(today, -(PATTERN_WINDOW_DAYS - 1))

  const { data: logs = [] } = useQuery({
    queryKey: ['life-pattern', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('category, event_on')
        .eq('pet_id', petId)
        .in('category', PATTERN_CATEGORIES as unknown as string[])
        .gte('event_on', from)
      return (data ?? []) as LogRecord[]
    },
  })

  const pattern = computeLifePattern(logs, today)
  if (!pattern.hasEnoughData) return null

  return (
    <Link
      href={`/schedule?pet=${petId}&view=today`}
      className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden>📊</span>
        <span className="font-semibold text-gray-800 text-sm">{t('title')}</span>
        <span className="text-xs text-gray-400 ml-auto">{t('window', { days: pattern.days })}</span>
      </div>

      {/* 이상 신호 — 규칙적이던 기록이 며칠째 비었을 때만 (체중 카드의 급변 경고와 같은 톤) */}
      {pattern.headline && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mb-2">
          <span aria-hidden>{careCategoryIcon(pattern.headline.category)}</span>{' '}
          {t('gapAlert', { category: pattern.headline.category, days: pattern.headline.anomaly.days })}
        </p>
      )}

      <div className="space-y-2">
        {pattern.categories.map(c => (
          <PatternRow key={c.category} pattern={c} todayLabel={t('today')} baselineLabel={t('perDay')} />
        ))}
      </div>
    </Link>
  )
}

/** 한 카테고리의 미니 막대 추이 + 오늘/평소 요약 */
function PatternRow({
  pattern,
  todayLabel,
  baselineLabel,
}: {
  pattern: CategoryPattern
  todayLabel: string
  baselineLabel: string
}) {
  const max = Math.max(1, ...pattern.series)
  const gap = pattern.anomaly != null
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-6 text-base text-center shrink-0" aria-hidden>{careCategoryIcon(pattern.category)}</span>

      {/* 14일 미니 막대 — 0은 옅게, 오늘 막대는 강조 */}
      <div className="flex items-end gap-[2px] h-6 flex-1 min-w-0" aria-hidden>
        {pattern.series.map((count, i) => {
          const isToday = i === pattern.series.length - 1
          const h = count === 0 ? 3 : Math.round((count / max) * 100)
          return (
            <span
              key={i}
              className={`flex-1 rounded-sm ${
                count === 0
                  ? 'bg-gray-100'
                  : isToday
                    ? 'bg-primary-600'
                    : 'bg-primary-300'
              }`}
              style={{ height: count === 0 ? 3 : `${Math.max(h, 12)}%` }}
            />
          )
        })}
      </div>

      {/* 오늘/평소 요약 — 공백이면 오늘 값을 앰버로 */}
      <div className="shrink-0 text-right leading-tight">
        <span className={`text-xs font-semibold ${gap ? 'text-amber-600' : 'text-gray-700'}`}>
          {todayLabel} {pattern.today}
        </span>
        {pattern.baseline != null && (
          <span className="block text-[10px] text-gray-400">
            {baselineLabel} {pattern.baseline}
          </span>
        )}
      </div>
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { addDays, formatDistance, formatWon, todayKST } from '@/lib/utils'
import { computeWeeklyRecap, hasRecapActivity, type RecapRecord, type RecapWalk } from '@/lib/weeklyRecap'
import { computeCareLevel, computeCarePoints } from '@/lib/careLevel'

/**
 * 홈 '이번 주 리포트' 카드 — 최근 7일 산책·기록·지출 요약 + 반려동물 성장 레벨.
 * 재방문·체류 유도(리텐션)와 게임화(레벨업 성취감)를 한 카드에 담는다.
 * 대시보드 SSR을 무겁게 하지 않도록, 선택된 아이 기준으로 기간을 좁혀(최근 7일) 클라이언트에서 조회한다.
 */
export function WeeklyReportCard() {
  const t = useTranslations('report')
  const supabase = createClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null

  const { data } = useQuery({
    queryKey: ['weekly-report', selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const today = todayKST()
      const weekStart = addDays(today, -6) // 오늘 포함 최근 7일
      const weekStartIso = `${weekStart}T00:00:00+09:00` // 산책 started_at(timestamptz) KST 경계

      const [walksRes, recordsRes, recCntRes, walkCntRes] = await Promise.all([
        supabase.from('walks').select('duration_s, distance_m')
          .eq('pet_id', selectedPetId!).gte('started_at', weekStartIso),
        supabase.from('records').select('category, cost, event_on')
          .eq('pet_id', selectedPetId!).gte('event_on', weekStart),
        // 누적 케어 포인트용 전체 건수(head 카운트라 가벼움)
        supabase.from('records').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
        supabase.from('walks').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
      ])

      const recap = computeWeeklyRecap(
        (walksRes.data ?? []) as RecapWalk[],
        (recordsRes.data ?? []) as RecapRecord[],
      )
      const points = computeCarePoints(recCntRes.count ?? 0, walkCntRes.count ?? 0)
      return { recap, points }
    },
  })

  if (!pet || !data) return null
  const { recap, points } = data
  // 활동이 전혀 없고 누적 포인트도 0이면(신규 등록 직후) 빈 카드를 숨긴다.
  if (!hasRecapActivity(recap) && points === 0) return null

  const level = computeCareLevel(points)

  return (
    <div className="card space-y-4">
      {/* 헤더: 제목 + 성장 레벨 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{t('subtitle', { name: pet.name })}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 rounded-full px-2.5 py-1">
            <span aria-hidden>⭐</span>{t('levelLabel', { level: level.level })}
          </span>
          <p className="text-[11px] font-semibold text-gray-500 mt-1">{level.title}</p>
        </div>
      </div>

      {/* 레벨 진행바 */}
      <div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
            style={{ width: `${level.progressPct}%` }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-1 text-right">
          {level.nextThreshold != null
            ? t('nextLevel', { points: level.nextThreshold - level.points })
            : t('maxLevel')}
        </p>
      </div>

      {/* 이번 주 지표 4종 */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat icon="🦮" label={t('walks')} value={`${recap.walkCount}${t('walksUnit')}`} />
        <Stat icon="📏" label={t('distance')} value={formatDistance(recap.distanceM)} />
        <Stat icon="📝" label={t('records')} value={`${recap.logCount}${t('recordsUnit')}`} />
        <Stat icon="🧾" label={t('spend')} value={formatWon(recap.spend)} />
      </div>

      <p className="text-xs text-center text-gray-500">
        {recap.activeDays > 0 ? t('activeDays', { days: recap.activeDays }) : t('activeDaysZero')}
      </p>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl py-2.5 px-1">
      <div className="text-lg leading-none" aria-hidden>{icon}</div>
      <div className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}

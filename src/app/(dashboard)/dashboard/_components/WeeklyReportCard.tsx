'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { addDays, formatDistance, formatWon, isoToKstDate, todayKST } from '@/lib/utils'
import { computeWeeklyRecap, hasRecapActivity, type RecapRecord, type RecapWalk } from '@/lib/weeklyRecap'
import { computeCareLevel, computeCarePoints, type CareLevel } from '@/lib/careLevel'

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
  // 레벨업 순간 축하 — 이 아이의 레벨이 지난 방문보다 올랐으면 한 번 배너로 자축한다.
  // (레벨 표시만 있고 '올라간 순간'의 보상이 없던 것을 보완 — 게임화 몰입.)
  const [leveledUpTo, setLeveledUpTo] = useState<CareLevel | null>(null)

  const { data } = useQuery({
    queryKey: ['weekly-report', selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const today = todayKST()
      const weekStart = addDays(today, -6) // 오늘 포함 최근 7일
      const weekStartIso = `${weekStart}T00:00:00+09:00` // 산책 started_at(timestamptz) KST 경계

      const [walksRes, recordsRes, recCntRes, walkCntRes] = await Promise.all([
        supabase.from('walks').select('duration_s, distance_m, started_at')
          .eq('pet_id', selectedPetId!).gte('started_at', weekStartIso),
        // event_on 은 사용자가 고르는 값이라 미래 날짜(예정 진료·미리 입력한 기록)일 수 있다.
        // 상한(오늘)이 없으면 이번 주 지출·기록·함께한 날이 미래 기록으로 부풀려진다.
        // (산책은 started_at 절대시각으로 이미 안전 — 기록 쪽만 상한을 건다.)
        supabase.from('records').select('category, cost, event_on')
          .eq('pet_id', selectedPetId!).gte('event_on', weekStart).lte('event_on', today),
        // 누적 케어 포인트용 전체 건수(head 카운트라 가벼움)
        supabase.from('records').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
        supabase.from('walks').select('id', { count: 'exact', head: true }).eq('pet_id', selectedPetId!),
      ])

      // started_at(절대시각)을 KST 날짜로 변환해 '산책만 한 날'도 함께한 날 수에 포함되게 한다.
      const walkRows = (walksRes.data ?? []) as { duration_s: number; distance_m: number; started_at: string }[]
      const recap = computeWeeklyRecap(
        walkRows.map(w => ({ duration_s: w.duration_s, distance_m: w.distance_m, dateKst: isoToKstDate(w.started_at) })) as RecapWalk[],
        (recordsRes.data ?? []) as RecapRecord[],
      )
      const points = computeCarePoints(recCntRes.count ?? 0, walkCntRes.count ?? 0)
      return { recap, points }
    },
  })

  // 레벨업 감지: 이 아이의 마지막으로 본 레벨을 localStorage 에 저장해두고, 다시 방문했을 때
  // 레벨이 올랐으면 축하 배너를 띄운다. 첫 방문(저장값 없음)엔 자축 없이 현재 레벨만 기록한다.
  useEffect(() => {
    if (!data || !selectedPetId) return
    const lvl = computeCareLevel(data.points)
    const key = `petcare_seen_level_${selectedPetId}`
    try {
      const raw = window.localStorage.getItem(key)
      const seen = raw != null ? parseInt(raw, 10) : null
      if (seen != null && Number.isFinite(seen) && lvl.level > seen) setLeveledUpTo(lvl)
      if (seen == null || lvl.level !== seen) window.localStorage.setItem(key, String(lvl.level))
    } catch { /* localStorage 접근 불가(사생활 모드 등) — 축하 생략 */ }
  }, [data, selectedPetId])

  if (!pet || !data) return null
  const { recap, points } = data
  // 활동이 전혀 없고 누적 포인트도 0이면(신규 등록 직후) 빈 카드를 숨긴다.
  if (!hasRecapActivity(recap) && points === 0) return null

  const level = computeCareLevel(points)

  return (
    <div className="card space-y-4">
      {/* 레벨업 자축 배너 — 레벨이 오른 순간 한 번 축하한다(닫으면 다시 뜨지 않음). */}
      {leveledUpTo && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-100 to-primary-50 px-3 py-2">
          <span className="text-lg leading-none animate-bounce" aria-hidden>🎉</span>
          <p className="flex-1 text-sm font-bold text-amber-900">
            {t('levelUp', { level: leveledUpTo.level, title: leveledUpTo.title })}
          </p>
          <button onClick={() => setLeveledUpTo(null)} aria-label={t('levelUpDismiss')}
            className="shrink-0 text-amber-500 hover:text-amber-700">✕</button>
        </div>
      )}

      {/* 헤더: 제목 + 성장 레벨 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">{t('title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{t('subtitle', { name: pet.name })}</p>
        </div>
        {/* 레벨 배지를 누르면 성취 컬렉션으로 — 게임화 몰입(뱃지 모으기) 동선 */}
        <Link href="/achievements" className="shrink-0 text-right group">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 group-hover:bg-primary-100 rounded-full px-2.5 py-1 transition-colors">
            <span aria-hidden>⭐</span>{t('levelLabel', { level: level.level })}
          </span>
          <p className="text-[11px] font-semibold text-gray-500 mt-1">{level.title} ›</p>
        </Link>
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
      <div className="text-xs text-gray-400 mt-0.5 truncate">{label}</div>
    </div>
  )
}

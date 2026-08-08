'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { addDays, computeLogStreak, todayKST } from '@/lib/utils'
import { DAILY_LOG_CATEGORIES } from '@/lib/records'
import { computeTodayCare } from '@/lib/todayCare'
import { petMood, petSpeech } from '@/lib/petMood'
import { computeCareLevel, computeCarePoints } from '@/lib/careLevel'

/** 연속 기록 계산 창(일) — 홈 대시보드(STREAK_WINDOW_DAYS)와 동일 기준. 이보다 긴 연속은 이
 *  창으로 제한되지만 표시용 배지엔 충분하고 조회 행 수를 합리적으로 제한한다. */
const STREAK_WINDOW_DAYS = 60

/**
 * 아이 상세 페이지용 '캐릭터 · 성장' 카드.
 *
 * 홈 요약 카드(SelectedPetSummary)에만 있던 캐릭터 반응(기분 이모지·말풍선)과 성장 레벨을,
 * 아이 하나에 온전히 집중하는 상세 화면에도 그대로 가져온다. 상세는 여태 평평한 프로필이라
 * 앱의 게임화·정서적 신호가 전혀 보이지 않았다(발견성·일관성 공백).
 *
 * 홈 요약 카드와 같은 캐시 키(['today-log'·'today-walk', petId])를 공유해, 한쪽에서 원탭
 * 기록하면 이 카드의 표정·완료도도 함께 갱신된다. streak·성장 레벨은 이 카드 전용 키를 쓰며,
 * 상세 페이지의 afterRecord 가 함께 무효화한다(같은 페이지에서 기록하면 즉시 반영).
 *
 * 순수 로직(petMood·petSpeech·computeTodayCare·computeCareLevel·computeLogStreak)은 각
 * lib 에서 결정적으로 계산·테스트된다 — 이 컴포넌트는 조회·표시만 담당한다.
 */
export function PetCharacterCard({ petId, petName }: { petId: string; petName: string }) {
  const t = useTranslations('petCharacter')
  const tr = useTranslations('report')
  const supabase = createClient()
  const today = todayKST()

  // 오늘 생활기록(밥·물·배변 등) — QuickLogBar·홈 요약카드와 동일 키·형태로 캐시 공유.
  const { data: todayLogs = [] } = useQuery({
    queryKey: ['today-log', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('id, category, event_at')
        .eq('pet_id', petId)
        .eq('event_on', today)
        .order('event_at', { ascending: false })
      return (data ?? []) as { id: string; category: string; event_at: string | null }[]
    },
  })

  // 오늘 산책 여부 — 홈 요약카드와 동일 키로 캐시 공유.
  const { data: walkedToday = false } = useQuery({
    queryKey: ['today-walk', petId],
    queryFn: async () => {
      const { count } = await supabase
        .from('walks')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', petId)
        .gte('started_at', `${today}T00:00:00+09:00`)
      return (count ?? 0) > 0
    },
  })

  // 생활기록 연속일(streak) — 최근 STREAK_WINDOW_DAYS 로 범위를 좁혀 조회(무제한 방지).
  const { data: streak = 0, isLoading: streakLoading } = useQuery({
    queryKey: ['pet-streak', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('event_on')
        .eq('pet_id', petId)
        .in('category', DAILY_LOG_CATEGORIES as unknown as string[])
        .gte('event_on', addDays(today, -STREAK_WINDOW_DAYS))
      return computeLogStreak((data ?? []).map(r => (r as { event_on: string }).event_on), today)
    },
  })

  // 성장 레벨 — 누적 기록 수 + 산책 수(가중)로 계산(head 카운트라 가볍다).
  const { data: level, isLoading: levelLoading } = useQuery({
    queryKey: ['pet-care-points', petId],
    queryFn: async () => {
      const [recRes, walkRes] = await Promise.all([
        supabase.from('records').select('id', { count: 'exact', head: true }).eq('pet_id', petId),
        supabase.from('walks').select('id', { count: 'exact', head: true }).eq('pet_id', petId),
      ])
      return computeCareLevel(computeCarePoints(recRes.count ?? 0, walkRes.count ?? 0))
    },
  })

  // 성장 레벨·연속일이 아직 로딩 중이면 자리만 잡는 스켈레톤(기본값 0/첫만남이 잠깐 비쳤다
  // 튀는 깜빡임 방지). 둘 다 준비되면 렌더.
  if (streakLoading || levelLoading || !level) {
    return <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" aria-hidden />
  }

  const todayCare = computeTodayCare(todayLogs.map(r => r.category), walkedToday)
  const mood = petMood(streak, todayCare.doneCount, todayCare.total)
  const speech = petSpeech(streak, todayCare.doneCount, todayCare.total)
  const allDone = todayCare.total > 0 && todayCare.doneCount >= todayCare.total

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-500">{t('heading')}</p>
        {/* 성취 컬렉션으로 — 게임화 몰입(레벨·뱃지 모으기) 동선 */}
        <Link href="/achievements" className="text-xs text-primary-600 font-semibold shrink-0">
          {t('viewAchievements')}
        </Link>
      </div>

      {/* 기분 말풍선 — 아이가 말을 거는 한 줄(오늘 돌봄·연속 상태에 따라 대사가 바뀐다) */}
      <div className="flex items-start gap-2.5 rounded-xl bg-primary-50 px-3 py-2.5" title={mood.label}>
        <span aria-label={mood.label} role="img" className="text-2xl leading-none shrink-0">{mood.emoji}</span>
        <p className="text-sm leading-snug text-gray-800">{speech}</p>
      </div>

      {/* 오늘 핵심 돌봄 완주 리본 — 하루를 마친 순간의 즉각 보상(홈 요약카드와 같은 결) */}
      {allDone && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-100 text-amber-900 px-3 py-2">
          <span aria-hidden className="text-base leading-none">🎉</span>
          <p className="text-[13px] font-bold leading-snug">{t('missionComplete', { name: petName })}</p>
        </div>
      )}

      {/* 연속 기록 배지 + 성장 레벨 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {streak >= 2 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
            {t('streakBadge', { days: streak })}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-100 rounded-full px-2 py-0.5">
          <span aria-hidden>⭐</span>{tr('levelLabel', { level: level.level })}
        </span>
        <span className="text-[11px] font-semibold text-gray-500">{level.title}</span>
      </div>

      {/* 레벨 진행바 */}
      <div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
            style={{ width: `${level.progressPct}%` }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-1 text-right">
          {level.nextThreshold != null
            ? tr('nextLevel', { points: level.nextThreshold - level.points })
            : tr('maxLevel')}
        </p>
      </div>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { addDays, computeLogStreak, computeLongestStreak, todayKST } from '@/lib/utils'
import { DAILY_LOG_CATEGORIES } from '@/lib/records'
import { useTodayLog, useWalkedToday } from '@/hooks/useTodayActivity'
import { computeTodayCare } from '@/lib/todayCare'
import { petMood, petSpeech } from '@/lib/petMood'
import { computeCareLevel, computeCarePoints } from '@/lib/careLevel'

/** 최고 기록(최장 연속)·현재 연속을 함께 산출할 조회 창(일). '자기 최고 기록'이 의미를 가지려면
 *  현재 연속(홈 60일)보다 넉넉해야 하되, event_on 만 읽는 가벼운 조회라 반년으로 창을 제한해
 *  행 수를 합리적으로 묶는다. 이보다 오래된 기록은 최고 기록 산정에서 빠진다. */
const STREAK_WINDOW_DAYS = 180

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

  // 오늘 생활기록·산책 — QuickLogBar·홈 요약카드·오늘 돌봄 체크와 동일 키·형태로 캐시 공유(공용 훅).
  const { data: todayLogs = [] } = useTodayLog(petId)
  const { data: walkedToday = false } = useWalkedToday(petId)

  // 생활기록 연속일 — 현재 연속(current)과 자기 최고 기록(best)을 한 번의 조회로 함께 계산한다.
  // 최근 STREAK_WINDOW_DAYS 로 범위를 좁혀 조회(무제한 방지)하고, 같은 날짜 집합에서 두 값을 파생.
  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['pet-streak', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('event_on')
        .eq('pet_id', petId)
        .in('category', DAILY_LOG_CATEGORIES as unknown as string[])
        .gte('event_on', addDays(today, -STREAK_WINDOW_DAYS))
      const dates = (data ?? []).map(r => (r as { event_on: string }).event_on)
      return { current: computeLogStreak(dates, today), best: computeLongestStreak(dates, today) }
    },
  })
  const streak = streakData?.current ?? 0
  const bestStreak = streakData?.best ?? 0

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

      {/* 연속 기록 배지 + 자기 최고 기록 + 성장 레벨 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {streak >= 2 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
            {t('streakBadge', { days: streak })}
          </span>
        )}
        {/* 자기 최고 기록(최장 연속) — 연속이 끊겨도 '다시 최고 기록에 도전'이라는 재방문 동기를
            남긴다. 지금 연속이 최고와 같으면(=신기록 경신 중) 강조색으로, 아니면 도전 목표로 표시. */}
        {bestStreak >= 2 && (
          streak >= bestStreak ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-bold">
              {t('bestStreakRecord')}
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
              {t('bestStreak', { days: bestStreak })}
            </span>
          )
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

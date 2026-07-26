/**
 * 공유할 만한 '성취'를 고르는 순수 로직.
 * 홈 요약 카드의 연속 기록(streak)·함께한 날 이정표(milestone)를 이미지 카드로 자랑할 수 있게,
 * 지금 가장 내세울 성취 하나를 우선순위로 선택한다. (Math.random()·Date 미사용 — 결정적·테스트 가능)
 */

export type AchievementKind = 'milestoneToday' | 'streak'

export interface ShareableAchievement {
  kind: AchievementKind
  /** 카드 대표 이모지 */
  icon: string
  /** 대표 문구 (예: "12일 연속 기록 중", "함께한 지 100일!") */
  headline: string
}

/** 연속 기록을 '자랑'으로 공유할 최소 일수 — 홈 배지 노출(2일)보다 높여 성취감을 준다. */
export const STREAK_SHARE_MIN = 3

/**
 * 지금 공유할 성취를 우선순위로 하나 고른다. 없으면 null(공유 버튼 미노출).
 * 1) 오늘이 함께한 날 이정표(100·200…일) → 가장 특별하므로 최우선
 * 2) 연속 기록 STREAK_SHARE_MIN 일 이상
 * (다가오는 카운트다운·생일 등은 '달성'이 아니라 공유 대상에서 제외한다.)
 */
export function pickShareableAchievement(input: {
  streak: number
  milestone: { milestone: number; dday: number } | null
}): ShareableAchievement | null {
  const { streak, milestone } = input
  if (milestone && milestone.dday === 0) {
    return { kind: 'milestoneToday', icon: '🎉', headline: `함께한 지 ${milestone.milestone}일!` }
  }
  if (streak >= STREAK_SHARE_MIN) {
    return { kind: 'streak', icon: '🔥', headline: `${streak}일 연속 기록 중` }
  }
  return null
}

/** 공유 텍스트(캡션). 이미지 공유가 안 되는 환경의 텍스트 폴백에도 사용. */
export function achievementCaption(petName: string, headline: string): string {
  const who = petName.trim()
  return `${who ? `${who} · ` : ''}${headline} 🐾 펫케어에서 기록 중`
}

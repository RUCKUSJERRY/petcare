/**
 * '성취 뱃지' 순수 로직 — 성취 컬렉션 화면용.
 *
 * 컬렉션 뱃지는 한 번 얻으면 사라지지 않는 '단조 증가' 신호(누적 기록 수·누적 산책 수·함께한
 * 날수)만 사용한다. 연속 기록(streak)처럼 끊기면 사라지는 값은 성취감을 해치므로 컬렉션에서
 * 제외하고, 홈의 실시간 배지로만 다룬다.
 * Date·Math.random 미사용 — 결정적이라 테스트 가능.
 */

export type BadgeCategory = 'record' | 'walk' | 'together'

export interface BadgeDef {
  id: string
  category: BadgeCategory
  icon: string
  /** 뱃지 이름 */
  label: string
  /** 획득 임계값 */
  threshold: number
  /** 획득 조건 설명 */
  desc: string
}

export interface Badge extends BadgeDef {
  earned: boolean
  /** 현재 진척값(획득이면 임계값 이상) */
  current: number
  /** 진행률 0~100 (획득이면 100) */
  progressPct: number
}

/** 뱃지 정의(카테고리별 오름차순 임계값). 초반은 촘촘히(성취감), 뒤로 갈수록 넓게. */
export const BADGE_DEFS: BadgeDef[] = [
  // 기록 누적
  { id: 'record-1', category: 'record', icon: '📝', label: '첫 기록', threshold: 1, desc: '첫 생활/건강 기록 남기기' },
  { id: 'record-30', category: 'record', icon: '📗', label: '기록 30건', threshold: 30, desc: '기록 30건 달성' },
  { id: 'record-100', category: 'record', icon: '📚', label: '기록 100건', threshold: 100, desc: '기록 100건 달성' },
  { id: 'record-300', category: 'record', icon: '🏆', label: '기록 300건', threshold: 300, desc: '기록 300건 달성' },
  { id: 'record-500', category: 'record', icon: '👑', label: '기록 500건', threshold: 500, desc: '기록 500건 달성' },
  // 산책 누적
  { id: 'walk-1', category: 'walk', icon: '🐾', label: '첫 산책', threshold: 1, desc: '첫 산책 기록하기' },
  { id: 'walk-10', category: 'walk', icon: '🦮', label: '산책 10회', threshold: 10, desc: '산책 10회 달성' },
  { id: 'walk-30', category: 'walk', icon: '🌳', label: '산책 30회', threshold: 30, desc: '산책 30회 달성' },
  { id: 'walk-50', category: 'walk', icon: '⛰️', label: '산책 50회', threshold: 50, desc: '산책 50회 달성' },
  { id: 'walk-100', category: 'walk', icon: '🏅', label: '산책 100회', threshold: 100, desc: '산책 100회 달성' },
  // 함께한 날
  { id: 'together-100', category: 'together', icon: '💯', label: '함께 100일', threshold: 100, desc: '함께한 지 100일' },
  { id: 'together-200', category: 'together', icon: '💖', label: '함께 200일', threshold: 200, desc: '함께한 지 200일' },
  { id: 'together-365', category: 'together', icon: '🎂', label: '함께 1년', threshold: 365, desc: '함께한 지 1년' },
  { id: 'together-500', category: 'together', icon: '🌟', label: '함께 500일', threshold: 500, desc: '함께한 지 500일' },
  { id: 'together-1000', category: 'together', icon: '🎉', label: '함께 1000일', threshold: 1000, desc: '함께한 지 1000일' },
]

export interface BadgeInput {
  recordCount: number
  walkCount: number
  /** 함께한 날수 — 입양일 미상이면 null */
  togetherDays: number | null
}

function valueFor(category: BadgeCategory, input: BadgeInput): number {
  switch (category) {
    case 'record': return Math.max(0, Math.floor(input.recordCount))
    case 'walk': return Math.max(0, Math.floor(input.walkCount))
    case 'together': return Math.max(0, Math.floor(input.togetherDays ?? 0))
  }
}

/** 각 뱃지의 획득 여부·진행률을 계산한다. */
export function computeBadges(input: BadgeInput): Badge[] {
  return BADGE_DEFS.map(def => {
    const current = valueFor(def.category, input)
    const earned = current >= def.threshold
    const progressPct = earned ? 100 : Math.min(100, Math.round((current / def.threshold) * 100))
    return { ...def, earned, current, progressPct }
  })
}

/** 획득한 뱃지 수 / 전체 수 */
export function badgeProgress(badges: Badge[]): { earned: number; total: number } {
  return { earned: badges.filter(b => b.earned).length, total: badges.length }
}

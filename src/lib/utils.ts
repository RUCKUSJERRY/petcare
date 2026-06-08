import type { PetAge, Species } from '@/types'

/**
 * 생년월로부터 현재 개월 수, 나이 단계 등을 계산
 */
export function calcPetAge(birthYear: number, birthMonth: number, species: Species = 'dog'): PetAge {
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birthYear) * 12 + (now.getMonth() + 1 - birthMonth)

  const months = Math.max(0, totalMonths)
  const years = Math.floor(months / 12)
  const remainMonths = months % 12

  const displayText =
    years === 0
      ? `${months}개월`
      : remainMonths === 0
      ? `${years}살`
      : `${years}살 ${remainMonths}개월`

  const lifeStage: PetAge['lifeStage'] = species === 'cat'
    ? (months < 12 ? '키튼' : months < 120 ? '성묘' : '시니어')
    : (months < 12 ? '퍼피' : months < 84 ? '성견' : '시니어')

  return { months, years, displayText, lifeStage }
}

/**
 * 나이 단계별 색상 클래스 (Tailwind)
 */
export function lifeStageColor(stage: PetAge['lifeStage']): string {
  return ({
    퍼피: 'bg-amber-100 text-amber-800',
    키튼: 'bg-amber-100 text-amber-800',
    성견: 'bg-primary-100 text-primary-800',
    성묘: 'bg-primary-100 text-primary-800',
    시니어: 'bg-purple-100 text-purple-800',
  } as Record<string, string>)[stage] ?? 'bg-gray-100 text-gray-700'
}

/**
 * 음식 안전 등급 색상
 */
export function safetyColor(level: 'safe' | 'caution' | 'dangerous'): string {
  return {
    safe: 'bg-green-100 text-green-800',
    caution: 'bg-yellow-100 text-yellow-800',
    dangerous: 'bg-red-100 text-red-800',
  }[level]
}

export function safetyLabel(level: 'safe' | 'caution' | 'dangerous'): string {
  return { safe: '안전', caution: '주의', dangerous: '위험' }[level]
}

/**
 * cn 유틸 - tailwind 클래스 병합
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * 상대 시간 표시 ("방금 전", "3시간 전", "2일 전", 그 이상은 날짜)
 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/**
 * 가이드(건강/산책) 적용범위 우선순위 점수.
 * 견종별(3) > 크기별(2) > 공통(1) > 비해당(0)
 */
export function guideMatchScore(
  guide: { breed_id: string | null; size_category: string | null },
  breedId: string,
  sizeCategory: string | null
): number {
  if (guide.breed_id === breedId) return 3
  if (guide.size_category && guide.size_category === sizeCategory) return 2
  if (!guide.breed_id && !guide.size_category) return 1
  return 0
}

/**
 * 후보 가이드 중 우선순위가 가장 높은 1건 선택 (없으면 null).
 */
export function pickTopGuide<T extends { breed_id: string | null; size_category: string | null }>(
  guides: T[],
  breedId: string,
  sizeCategory: string | null
): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const g of guides) {
    const s = guideMatchScore(g, breedId, sizeCategory)
    if (s > bestScore) {
      best = g
      bestScore = s
    }
  }
  return best
}

/**
 * activity_type 별로 가장 우선순위 높은 가이드 1건씩 반환
 */
export function pickBestPerActivityType<
  T extends { breed_id: string | null; size_category: string | null; activity_type: string }
>(guides: T[], breedId: string, sizeCategory: string | null): Map<string, T> {
  const result = new Map<string, T>()
  for (const g of guides) {
    const score = guideMatchScore(g, breedId, sizeCategory)
    const current = result.get(g.activity_type)
    if (!current || score > guideMatchScore(current, breedId, sizeCategory)) {
      result.set(g.activity_type, g)
    }
  }
  return result
}

/**
 * 오늘 기준 D-day 계산. (날짜 문자열 YYYY-MM-DD)
 * 음수 = 지남, 0 = 오늘, 양수 = 남은 일수
 */
export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/** D-day 배지 텍스트와 톤 */
export function ddayBadge(dateStr: string): {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'upcoming'
} {
  const d = daysUntil(dateStr)
  if (d < 0) return { text: `${Math.abs(d)}일 지남`, tone: 'overdue' }
  if (d === 0) return { text: 'D-day', tone: 'today' }
  if (d <= 7) return { text: `D-${d}`, tone: 'soon' }
  return { text: `D-${d}`, tone: 'upcoming' }
}

/** D-day 톤별 색상 클래스 */
export function ddayToneClass(tone: 'overdue' | 'today' | 'soon' | 'upcoming'): string {
  return {
    overdue:  'bg-red-100 text-red-700',
    today:    'bg-red-100 text-red-700',
    soon:     'bg-amber-100 text-amber-700',
    upcoming: 'bg-gray-100 text-gray-500',
  }[tone]
}

/** 날짜 문자열(YYYY-MM-DD)에 개월 수를 더해 반환 */
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** 건강 관리 카테고리별 권장 재시행 주기(개월). null = 권장 주기 없음 */
export function careDefaultIntervalMonths(category: string): number | null {
  return ({
    접종: 12,
    심장사상충: 1,
    구충: 3,
    외부기생충: 1,
    건강검진: 12,
    기타: null,
  } as Record<string, number | null>)[category] ?? null
}

/** 건강 관리 카테고리별 아이콘 */
export function careCategoryIcon(category: string): string {
  return {
    접종:       '💉',
    심장사상충: '🪱',
    구충:       '🐛',
    외부기생충: '🦟',
    건강검진:   '🩺',
    기타:       '📋',
  }[category] ?? '📋'
}

/**
 * 커뮤니티 카테고리 색상
 */
export function categoryColor(category: string): string {
  return {
    질문: 'bg-blue-100 text-blue-700',
    자랑: 'bg-pink-100 text-pink-700',
    정보공유: 'bg-primary-100 text-primary-700',
    일상: 'bg-amber-100 text-amber-700',
  }[category] ?? 'bg-gray-100 text-gray-700'
}

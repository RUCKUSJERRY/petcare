import type { PetAge } from '@/types'

/**
 * 생년월로부터 현재 개월 수, 나이 단계 등을 계산
 */
export function calcPetAge(birthYear: number, birthMonth: number): PetAge {
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

  const lifeStage: PetAge['lifeStage'] =
    months < 12 ? '퍼피' : months < 84 ? '성견' : '시니어'

  return { months, years, displayText, lifeStage }
}

/**
 * 나이 단계별 색상 클래스 (Tailwind)
 */
export function lifeStageColor(stage: PetAge['lifeStage']): string {
  return {
    퍼피: 'bg-amber-100 text-amber-800',
    성견: 'bg-primary-100 text-primary-800',
    시니어: 'bg-purple-100 text-purple-800',
  }[stage]
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

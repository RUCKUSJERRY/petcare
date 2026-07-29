/**
 * 반려동물 '성장 레벨' 순수 로직 — 꾸준한 돌봄을 '레벨업'이라는 성취로 시각화해
 * 재방문·기록 지속을 유도하는 게임화(gamification) 요소.
 *
 * 케어 포인트 = 생활/건강 기록 수 + 산책 수(가중) 로 계산하고, 임계값 구간으로 레벨을 매긴다.
 * DB 스키마 변경 없이 기존 기록·산책 누적 수만으로 파생한다(추가 저장 불필요).
 * Date·Math.random 미사용 — 결정적이라 테스트 가능.
 */

export interface CareLevel {
  level: number
  /** 레벨 칭호 (예: '산책 친구') */
  title: string
  /** 현재 누적 케어 포인트 */
  points: number
  /** 다음 레벨까지 필요한 임계값. 최고 레벨이면 null */
  nextThreshold: number | null
  /** 현재 레벨 구간 내 진행률(0~100). 최고 레벨이면 100 */
  progressPct: number
}

/** 레벨 임계값(누적 케어 포인트)과 칭호. 앞구간은 촘촘히(초반 성취감), 뒤로 갈수록 넓게. */
export const CARE_LEVELS: { threshold: number; title: string }[] = [
  { threshold: 0, title: '첫 만남' },
  { threshold: 10, title: '돌봄 새내기' },
  { threshold: 30, title: '든든한 보호자' },
  { threshold: 70, title: '산책 친구' },
  { threshold: 150, title: '베스트 프렌드' },
  { threshold: 300, title: '케어 마스터' },
  { threshold: 600, title: '평생 단짝' },
]

/** 산책은 생활기록보다 손이 더 가므로 가중치를 둔다. */
export const WALK_POINT_WEIGHT = 3

/** 누적 기록 수·산책 수로 케어 포인트를 계산한다. */
export function computeCarePoints(recordCount: number, walkCount: number): number {
  const r = Math.max(0, Math.floor(recordCount))
  const w = Math.max(0, Math.floor(walkCount))
  return r + w * WALK_POINT_WEIGHT
}

/** 케어 포인트로 레벨·칭호·다음 레벨 진행률을 계산한다. */
export function computeCareLevel(points: number): CareLevel {
  const p = Math.max(0, Math.floor(points))
  // 임계값을 넘어선 가장 높은 구간을 현재 레벨로 (배열은 오름차순 전제)
  let idx = 0
  for (let i = 0; i < CARE_LEVELS.length; i++) {
    if (p >= CARE_LEVELS[i].threshold) idx = i
    else break
  }
  const current = CARE_LEVELS[idx]
  const isMax = idx === CARE_LEVELS.length - 1
  const next = isMax ? null : CARE_LEVELS[idx + 1]
  const progressPct = next
    ? Math.min(100, Math.round(((p - current.threshold) / (next.threshold - current.threshold)) * 100))
    : 100
  return {
    level: idx + 1,
    title: current.title,
    points: p,
    nextThreshold: next ? next.threshold : null,
    progressPct,
  }
}

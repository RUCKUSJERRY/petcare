import type { WalkSummary } from '@/lib/walkStats'
import type { CostStats } from '@/lib/costStats'
import type { UpcomingItem } from '@/lib/schedule'
import { daysUntil, formatWon } from '@/lib/utils'

/**
 * 챗봇 '읽기 툴' 출력 포매터 (순수).
 *
 * 챗봇이 사용자의 실제 데이터("이번 주 산책 몇 번?", "지난달 비용?", "다음 접종 언제?")에 답하도록,
 * 이미 테스트된 통계 lib(walkStats·costStats·schedule) 결과를 모델이 읽기 좋은 짧은 한국어로 바꾼다.
 * 조회(부수효과)는 툴 쪽에서 하고, 여기는 결정적 변환만 담당 — 테스트로 고정.
 */

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`)
const mins = (s: number) => `${Math.round(s / 60)}분`

/** 산책 요약 — 이번 주/이번 달/전체 횟수·거리. */
export function formatWalkSummary(name: string, s: WalkSummary): string {
  if (s.all.count === 0) return `${name}의 산책 기록이 아직 없어요.`
  const w = s.thisWeek
  const m = s.thisMonth
  return [
    `${name} 산책 요약`,
    `- 이번 주: ${w.count}회, ${km(w.distance_m)}, ${mins(w.duration_s)}`,
    `- 이번 달: ${m.count}회, ${km(m.distance_m)}`,
    `- 전체: ${s.all.count}회, ${km(s.all.distance_m)}`,
  ].join('\n')
}

/** 비용 요약 — 해당 연도 총액 + 지출 큰 카테고리 top 3. */
export function formatCostStats(name: string, s: CostStats): string {
  if (s.count === 0) return `${name}의 ${s.year}년 비용 기록이 없어요.`
  const top = s.byCategory.slice(0, 3).map(c => `${c.category} ${formatWon(c.total)}`).join(', ')
  return [
    `${name} ${s.year}년 비용`,
    `- 총 ${formatWon(s.total)} (기록 ${s.count}건)`,
    top ? `- 많이 쓴 항목: ${top}` : '',
  ].filter(Boolean).join('\n')
}

/** 다가오는 케어 일정 — 가까운 순 top N, D-day 표기. */
export function formatUpcoming(name: string, items: UpcomingItem[], today: string, limit = 5): string {
  if (items.length === 0) return `${name}의 예정된 건강 관리 일정이 없어요.`
  const sorted = [...items].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)).slice(0, limit)
  const line = (it: UpcomingItem) => {
    const d = daysUntil(it.next_due_on, today)
    const dday = d > 0 ? `D-${d}` : d === 0 ? '오늘' : `${-d}일 지남`
    return `- ${it.title} (${it.category}): ${it.next_due_on} ${dday}`
  }
  return [`${name} 다가오는 케어 일정`, ...sorted.map(line)].join('\n')
}

/** 최근 기록 목록. */
export interface RecentRecordRow {
  category: string
  event_on: string
  title?: string | null
  memo?: string | null
}
export function formatRecentRecords(name: string, rows: RecentRecordRow[]): string {
  if (rows.length === 0) return `${name}의 최근 기록이 없어요.`
  return [
    `${name} 최근 기록`,
    ...rows.map(r => `- ${r.event_on} ${r.category}${r.title && r.title !== r.category ? ` (${r.title})` : ''}${r.memo ? ` — ${r.memo}` : ''}`),
  ].join('\n')
}

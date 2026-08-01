import type { RecordCategory } from '@/types'
import { todayKST } from './utils'

/** 비용 집계에 필요한 최소 기록 형태 */
export interface CostRecord {
  category: RecordCategory
  event_on: string        // YYYY-MM-DD
  cost: number | null
  pet_id?: string
}

export interface MonthCost {
  month: number           // 1~12
  total: number
  count: number
}

export interface CategoryCost {
  category: RecordCategory
  total: number
  count: number
}

export interface CostStats {
  year: number
  total: number            // 해당 연도 총 지출
  count: number            // 비용이 있는 기록 수
  byMonth: MonthCost[]      // 길이 12 (1~12월, 비어도 0)
  byCategory: CategoryCost[] // 지출 큰 순 정렬
  maxMonthTotal: number     // 막대 그래프 정규화용 (최댓값)
}

/**
 * 기록 목록을 특정 연도 기준으로 월별·카테고리별 지출 통계로 집계한다.
 * cost 가 null/0 이하인 기록은 제외한다.
 * 미래로 입력된(event_on > today) 기록은 제외한다 — 상세 입력폼·영수증 스캔은 미래 날짜를
 * 막지 않아, 미리 적어둔 예정 지출이 올해 합계를 부풀리지 않도록 한다(주간 리포트와 동일 기준).
 */
export function aggregateCostStats(records: CostRecord[], year: number, today: string = todayKST()): CostStats {
  const byMonth: MonthCost[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, count: 0 }))
  const catMap = new Map<RecordCategory, CategoryCost>()
  let total = 0
  let count = 0

  for (const r of records) {
    if (!r.cost || r.cost <= 0) continue
    if (!r.event_on || r.event_on.slice(0, 4) !== String(year)) continue
    if (r.event_on > today) continue
    const m = Number(r.event_on.slice(5, 7))
    if (m < 1 || m > 12) continue

    byMonth[m - 1].total += r.cost
    byMonth[m - 1].count += 1
    total += r.cost
    count += 1

    const cur = catMap.get(r.category) ?? { category: r.category, total: 0, count: 0 }
    cur.total += r.cost
    cur.count += 1
    catMap.set(r.category, cur)
  }

  const byCategory = Array.from(catMap.values()).sort((a, b) => b.total - a.total)
  const maxMonthTotal = byMonth.reduce((mx, m) => Math.max(mx, m.total), 0)

  return { year, total, count, byMonth, byCategory, maxMonthTotal }
}

/** 기록들에서 비용이 기록된 연도 목록(내림차순). 없으면 올해만.
 *  미래로 입력된 기록은 제외해(aggregateCostStats 와 동일 기준) 없는 미래 연도가 목록에 끼지 않게 한다. */
export function costYears(records: CostRecord[], today: string = todayKST()): number[] {
  const set = new Set<number>()
  for (const r of records) {
    if (r.cost && r.cost > 0 && r.event_on && r.event_on <= today) set.add(Number(r.event_on.slice(0, 4)))
  }
  // 앱 전역의 '오늘'은 KST 기준(todayKST)이다. 기기 로컬 연도(new Date().getFullYear())로
  // 폴백하면 연말·연초 자정 부근에 비-KST 클라이언트가 엉뚱한 연도를 기본 선택할 수 있다.
  if (set.size === 0) set.add(Number(todayKST().slice(0, 4)))
  return Array.from(set).sort((a, b) => b - a)
}

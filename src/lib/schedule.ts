import type { RecordCategory } from '@/types'
import { PRODUCT_CATEGORIES } from './records'
import { activeNextDue } from './recurrence'

/**
 * 예정 일정 산출의 단일 출처.
 * 홈(대시보드)과 일정 화면이 각자 구현하던 "항목 라인별 최신 기록 → 다음 예정일" 로직을
 * 여기로 모아 중복·불일치(divergence)를 없앤다.
 */

/** 예정 산출에 필요한 기록의 최소 형태 (event_on 내림차순 정렬 전제) */
export interface ScheduleRow {
  id: string
  pet_id: string
  category: RecordCategory
  title: string
  event_on: string          // YYYY-MM-DD (마지막 시행/발생일)
  next_due_on: string | null
  recur_rule: string | null
}

/** 계산된 예정 항목 */
export interface UpcomingItem {
  record_id: string
  pet_id: string
  category: RecordCategory
  title: string
  last_on: string           // 최신 기록의 event_on
  next_due_on: string       // 활성 다음 예정일 (정렬·배지 기준)
  recur_rule: string | null
}

/**
 * "항목 라인"의 키. 제품성 카테고리(접종·구충 등)만 제목까지 구분하고,
 * 그 외는 아이·카테고리 단위로 하나의 라인으로 본다.
 */
export function scheduleLineKey(pet_id: string, category: RecordCategory, title: string): string {
  return PRODUCT_CATEGORIES.has(category)
    ? `${pet_id}|${category}|${title}`
    : `${pet_id}|${category}`
}

/**
 * 라인별로 "가장 최근 기록"만 남긴다.
 * 입력은 event_on 내림차순으로 정렬돼 있어야 하며(최신이 먼저), 그 순서에서 라인당 첫 행을 채택한다.
 */
export function latestRecordPerLine<T extends { pet_id: string; category: RecordCategory; title: string }>(
  rowsSortedByEventDesc: T[],
): T[] {
  const latest = new Map<string, T>()
  for (const r of rowsSortedByEventDesc) {
    const key = scheduleLineKey(r.pet_id, r.category, r.title)
    if (!latest.has(key)) latest.set(key, r)
  }
  return Array.from(latest.values())
}

/**
 * 라인별 최신 기록에서 활성 다음 예정일을 계산해 "예정 항목" 목록을 만든다.
 * 반복이 끝났거나 예정일이 없는 라인은 제외한다. (정렬은 호출부에서 필요에 맞게 수행)
 */
export function computeUpcoming(rowsSortedByEventDesc: ScheduleRow[], today: string): UpcomingItem[] {
  const items: UpcomingItem[] = []
  for (const r of latestRecordPerLine(rowsSortedByEventDesc)) {
    const due = activeNextDue(r.event_on, r.recur_rule, r.next_due_on, today)
    if (!due) continue
    items.push({
      record_id: r.id,
      pet_id: r.pet_id,
      category: r.category,
      title: r.title,
      last_on: r.event_on,
      next_due_on: due,
      recur_rule: r.recur_rule,
    })
  }
  return items
}

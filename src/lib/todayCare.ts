import type { RecordCategory } from '@/types'

/**
 * '오늘의 돌봄 체크' 순수 로직 — 홈 상단의 하루 습관 루프(재방문·기록 지속) 카드용.
 *
 * 매일 챙겨야 하는 핵심 돌봄 4가지(밥·물·배변·산책)를 "오늘 했는지"로 판정해
 * 체크리스트 + 완료 개수를 만든다. 기존 생활기록(records)·산책(walks) 데이터에서
 * 파생하므로 별도 저장이 없다(스키마 변경 불필요).
 *
 * - 산책(walk)은 records 카테고리가 아니라 walks 테이블에서 오는 값이라 category 가 없다.
 * - Date·Math.random 미사용 — 결정적이라 서버/클라이언트 동일 재현·테스트 가능.
 */

export interface TodayCareItemDef {
  key: 'meal' | 'water' | 'poop' | 'walk'
  icon: string
  /** 짧은 표시 라벨(ko 고정 — QuickLogBar 가 카테고리명을 그대로 쓰는 것과 동일 방침) */
  label: string
  /** 대응하는 생활기록 카테고리. 없으면(산책) walks 로 판정한다. */
  category?: RecordCategory
}

/** 하루 핵심 돌봄 항목(표시·판정 단일 출처). 순서 = 카드 표시 순서. */
export const TODAY_CARE_ITEMS: TodayCareItemDef[] = [
  { key: 'meal', icon: '🍚', label: '밥', category: '식사' },
  { key: 'water', icon: '🥤', label: '물', category: '물' },
  { key: 'poop', icon: '🚽', label: '배변', category: '배변' },
  { key: 'walk', icon: '🦮', label: '산책' },
]

export interface TodayCareCheckItem extends TodayCareItemDef {
  done: boolean
}

export interface TodayCareStatus {
  items: TodayCareCheckItem[]
  /** 오늘 챙긴 항목 수 */
  doneCount: number
  /** 전체 항목 수 */
  total: number
  /** 모두 챙겼는지 */
  allDone: boolean
}

/**
 * 오늘 남긴 생활기록 카테고리 집합과 '오늘 산책 여부'로 체크리스트 상태를 만든다.
 * @param loggedCategories 오늘(event_on=오늘) 남긴 기록들의 category 목록(중복·순서 무관)
 * @param walkedToday 오늘 산책 기록(walks)이 한 건이라도 있는지
 */
export function computeTodayCare(
  loggedCategories: Iterable<string>,
  walkedToday: boolean,
): TodayCareStatus {
  const set = loggedCategories instanceof Set ? loggedCategories : new Set(loggedCategories)
  const items = TODAY_CARE_ITEMS.map((def): TodayCareCheckItem => ({
    ...def,
    done: def.category ? set.has(def.category) : walkedToday,
  }))
  const doneCount = items.reduce((n, it) => n + (it.done ? 1 : 0), 0)
  return { items, doneCount, total: items.length, allDone: doneCount === items.length }
}

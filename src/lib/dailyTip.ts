import type { Species } from '@/types'
import { careGuidesForSpecies } from './careGuideData'
import { foodGuidesForSpecies } from './foodGuideData'

/**
 * '오늘의 케어 팁' — 매일 하나씩 바뀌는 짧은 관리 팁.
 *
 * 새 콘텐츠를 지어내지 않고, 이미 큐레이션된 정적 데이터(careGuideData·foodGuideData)에서
 * 짧은 한 줄을 모아 풀(pool)을 만든 뒤 날짜로 결정적(deterministic)으로 하나를 고른다.
 * - 날짜가 같으면 항상 같은 팁 → 하루 동안 흔들리지 않음.
 * - 날짜가 바뀌면 다른 팁 → 매일 다시 볼 이유(재방문·체류)를 만든다.
 * - Math.random()·Date.now() 를 쓰지 않아 서버/클라이언트에서 동일하게 재현·테스트 가능.
 */
export interface DailyTip {
  icon: string
  /** 팁이 속한 주제(예: '양치', '급여') — 카드 상단 라벨 */
  category: string
  text: string
  /** 더 알아보기 링크(해당 가이드 화면) */
  href: string
}

/** 종별 팁 후보 풀. 순서는 결정적(입력 데이터 순서 그대로)이라 날짜 해시와 함께 재현 가능. */
export function tipPool(species: Species): DailyTip[] {
  const pool: DailyTip[] = []

  // 생활관리 가이드의 팁(tips)·주기(frequency) 한 줄 — 짧고 실천적이라 팁에 적합
  for (const g of careGuidesForSpecies(species)) {
    for (const tip of g.tips ?? []) {
      pool.push({ icon: g.icon, category: g.topic, text: tip, href: '/care' })
    }
  }

  // 사료·급여 가이드의 포인트 — 급여/체형 관련 실천 정보
  for (const g of foodGuidesForSpecies(species)) {
    for (const point of g.points) {
      pool.push({ icon: g.icon, category: g.title, text: point, href: '/foods' })
    }
  }

  return pool
}

/** 문자열 → 32bit 정수 해시(결정적). 날짜(YYYY-MM-DD) 문자열을 인덱스로 바꾸는 데 쓴다. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * 해당 날짜(KST 'YYYY-MM-DD')의 오늘의 팁을 결정적으로 고른다.
 * 풀이 비면 null(방어적 — 정상적으로는 항상 콘텐츠가 있다).
 */
export function getDailyTip(species: Species, dateStr: string): DailyTip | null {
  const pool = tipPool(species)
  if (pool.length === 0) return null
  return pool[hashString(dateStr) % pool.length]
}

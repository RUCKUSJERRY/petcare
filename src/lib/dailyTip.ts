import type { Species } from '@/types'
import { careGuidesForSpecies } from './careGuideData'
import { foodGuidesForSpecies } from './foodGuideData'
import { healthChecklistFor, type LifeStage } from './healthChecklist'

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

/**
 * 종(·생애단계)별 팁 후보 풀. 순서는 결정적(입력 데이터 순서 그대로)이라 날짜 해시와 함께 재현 가능.
 *
 * @param stage 생략 시 종 공통 팁만. 넘기면 그 생애단계(퍼피/시니어 등) 맞춤 팁을 더해
 *   '우리 아이 나이대'에 맞는 팁이 섞여 나온다(정보 고도화 — 나이 맞춤). '미상'이면 성체 기준.
 */
export function tipPool(species: Species, stage?: LifeStage | '미상'): DailyTip[] {
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

  // 생애단계 맞춤 팁 — 그 시기 건강 체크리스트(종×단계로 이미 큐레이션됨)를 팁으로 재사용해
  // 나이대에 맞는 예방·관찰 포인트가 오늘의 팁에 섞이게 한다. 더보기는 건강 정보(/health)로.
  if (stage) {
    for (const item of healthChecklistFor(species, stage).items) {
      pool.push({ icon: item.icon, category: item.title, text: item.detail, href: '/health' })
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
 *
 * @param stage 생략 가능. 넘기면 종 공통 팁 + 그 생애단계 맞춤 팁에서 고른다(나이 맞춤).
 */
export function getDailyTip(species: Species, dateStr: string, stage?: LifeStage | '미상'): DailyTip | null {
  const pool = tipPool(species, stage)
  if (pool.length === 0) return null
  return pool[hashString(dateStr) % pool.length]
}

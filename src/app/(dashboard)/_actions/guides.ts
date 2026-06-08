'use server'

import { getHealthGuides, getWalkGuides } from '@/lib/staticData'
import type { HealthGuide, WalkGuide } from '@/types'

/**
 * 서버 액션으로 캐시된 가이드를 제공한다.
 * getHealthGuides/getWalkGuides는 unstable_cache(1시간)로 감싸져 있어
 * 모든 사용자/요청에 걸쳐 서버 측에서 공유 캐싱된다.
 * (클라이언트 react-query 캐시는 세션 한정이라 별도 이점)
 */
export async function fetchHealthGuides(): Promise<HealthGuide[]> {
  return getHealthGuides()
}

export async function fetchWalkGuides(): Promise<WalkGuide[]> {
  return getWalkGuides()
}

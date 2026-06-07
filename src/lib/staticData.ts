import { unstable_cache } from 'next/cache'
import { createStaticClient } from './supabase/static'
import type { WalkGuide, HealthGuide } from '@/types'

// 마스터 데이터는 거의 바뀌지 않으므로 1시간 캐시.
// (관리 시점에 바뀌면 revalidateTag('guides')로 무효화 가능)
const REVALIDATE = 3600

/** 전체 산책 가이드 (캐시) */
export const getWalkGuides = unstable_cache(
  async (): Promise<WalkGuide[]> => {
    const sb = createStaticClient()
    const { data } = await sb.from('walk_guides').select('*')
    return (data ?? []) as WalkGuide[]
  },
  ['walk_guides_all'],
  { revalidate: REVALIDATE, tags: ['guides'] }
)

/** 전체 건강 가이드 (캐시) */
export const getHealthGuides = unstable_cache(
  async (): Promise<HealthGuide[]> => {
    const sb = createStaticClient()
    const { data } = await sb.from('health_guides').select('*')
    return (data ?? []) as HealthGuide[]
  },
  ['health_guides_all'],
  { revalidate: REVALIDATE, tags: ['guides'] }
)

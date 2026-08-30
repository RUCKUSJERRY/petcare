import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { todayKST } from '@/lib/utils'

export type TodayLog = { id: string; category: string; event_at: string | null }

/**
 * 오늘(KST) 생활기록 목록 — QuickLogBar·홈 요약카드·오늘 돌봄 체크·캐릭터 카드가 단일 캐시 키
 * ['today-log', petId] 를 공유한다. 여러 화면이 같은 키를 쓰므로 select 형태가 어긋나면 먼저
 * 마운트된 쪽의 데이터가 캐시를 차지해 반대쪽이 깨진다(id/category/event_at 를 기대하는 곳에서
 * count 만 든 캐시를 만나는 식). 예전엔 이 조회 본문이 4곳에 손으로 복제돼 있어, 한 곳의 select
 * 를 바꾸면 나머지가 조용히 깨질 위험이 있었다 — 조회를 이 훅 하나로 모아 형태 불변식을 강제한다.
 * petId 가 null(미선택)이면 조회하지 않는다.
 */
export function useTodayLog(petId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['today-log', petId],
    enabled: !!petId,
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('id, category, event_at')
        .eq('pet_id', petId!)
        .eq('event_on', todayKST())
        .order('event_at', { ascending: false })
      return (data ?? []) as TodayLog[]
    },
  })
}

/**
 * 오늘(KST) 산책 여부 — 홈 요약카드·오늘 돌봄 체크·캐릭터 카드가 ['today-walk', petId] 캐시를
 * 공유한다. today-log 와 같은 이유로 조회를 이 훅으로 모아 캐시 형태를 일치시킨다.
 * (하루 경계는 KST 자정 +09:00 고정 오프셋 — 기기 시간대와 무관하게 서버 집계와 맞춘다.)
 */
export function useWalkedToday(petId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['today-walk', petId],
    enabled: !!petId,
    queryFn: async () => {
      const { count } = await supabase
        .from('walks')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', petId!)
        .gte('started_at', `${todayKST()}T00:00:00+09:00`)
      return (count ?? 0) > 0
    },
  })
}

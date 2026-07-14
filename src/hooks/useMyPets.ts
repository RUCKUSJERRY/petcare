import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import type { Pet } from '@/types'

/**
 * 로그인한 사용자의 반려동물 목록(견종 조인 포함).
 * 모든 클라이언트 화면이 단일 캐시 키('my-pets')를 공유해
 * 중복 요청을 줄이고 데이터 일관성을 유지한다.
 * 펫 추가/수정/삭제 시 'my-pets' 키를 무효화하면 전체가 갱신됨.
 */
export function useMyPets() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['my-pets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as Pet[]
      // 멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환하므로 user_id 필터 불필요
      // (공동 관리로 초대받은 아이도 함께 표시됨)
      const { data, error } = await supabase
        .from('pets')
        .select('*, breed:breeds(*)')
        .order('created_at')
      // 네트워크/RLS 오류를 던져 isError 로 표면화한다. 던지지 않으면 일시적 실패가 []('아이 없음')
      // 과 구분되지 않아, 아이를 가진 사용자에게 "첫 아이 등록" 온보딩이 뜨고 FAB 이 사라진다.
      if (error) throw error
      return (data ?? []) as Pet[]
    },
  })
}

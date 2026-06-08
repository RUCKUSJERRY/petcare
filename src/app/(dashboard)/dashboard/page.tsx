import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor } from '@/lib/utils'
import Link from 'next/link'
import type { Pet, PostListItem } from '@/types'
import { PetSection } from './_components/PetSection'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .eq('user_id', user!.id)
    .order('created_at')

  // 30일 이내 접종 예정 + 지난 접종 알림
  const petIds = (pets ?? []).map((p: Pet) => p.id)
  const today = new Date().toISOString().slice(0, 10)
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  type VaccAlert = { pet_id: string; vaccine_name: string; next_due_on: string }
  let vaccAlerts: VaccAlert[] = []
  if (petIds.length > 0) {
    const { data } = await supabase
      .from('vaccination_records')
      .select('pet_id, vaccine_name, next_due_on')
      .in('pet_id', petIds)
      .not('next_due_on', 'is', null)
      .lte('next_due_on', soon)
      .order('next_due_on')
    vaccAlerts = (data ?? []) as VaccAlert[]
  }

  // 최근 커뮤니티 글 (위젯용)
  const { data: recentPostsData } = await supabase
    .from('post_list')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)
  const recentPosts = (recentPostsData ?? []) as PostListItem[]

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 (프로필 버튼은 전역 AppHeader로 이동) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">우리 아이들</h1>
        <Link href="/pets/new" className="btn-primary text-sm py-1.5 px-3">
          + 등록
        </Link>
      </div>

      {/* 펫 영역 (요약 카드 + 다른 아이들 목록) */}
      <PetSection pets={(pets ?? []) as Pet[]} vaccAlerts={vaccAlerts} />

      {/* 접종 예정 알림 */}
      {vaccAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span>💉</span>
            <span className="font-semibold text-amber-800 text-sm">접종 알림</span>
          </div>
          {vaccAlerts.slice(0, 3).map((v, i) => {
            const pet = (pets as Pet[]).find(p => p.id === v.pet_id)
            const isOverdue = v.next_due_on < today
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>{isOverdue ? '⚠️' : '📅'}</span>
                <span className="text-gray-700 truncate flex-1">
                  {pet?.name} · {v.vaccine_name}
                </span>
                <span className={`text-xs font-medium shrink-0 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                  {v.next_due_on}{isOverdue ? ' (지남)' : ''}
                </span>
              </div>
            )
          })}
          {vaccAlerts.length > 3 && (
            <p className="text-xs text-amber-600 pt-0.5">외 {vaccAlerts.length - 3}건 더</p>
          )}
          <Link href="/pets" className="block text-xs text-amber-700 font-semibold pt-1">
            접종 기록 확인하기 →
          </Link>
        </div>
      )}

      {/* 최근 커뮤니티 글 */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">커뮤니티 최근 글</h2>
            <div className="flex items-center gap-3">
              <Link href="/community" className="text-xs text-gray-400 font-medium">
                더보기
              </Link>
              <Link href="/community/new" className="text-xs text-primary-600 font-semibold">
                글쓰기 →
              </Link>
            </div>
          </div>
          <div className="space-y-2">
            {recentPosts.map(post => (
              <Link key={post.id} href={`/community/${post.id}`}>
                <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${categoryColor(post.category)}`}>
                    {post.category}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-800">
                    {post.title}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(post.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

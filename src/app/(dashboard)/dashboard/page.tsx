import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor } from '@/lib/utils'
import Link from 'next/link'
import type { CareAlert, Pet, PostListItem } from '@/types'
import { PetSection } from './_components/PetSection'
import { VaccAlerts } from './_components/VaccAlerts'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .eq('user_id', user!.id)
    .order('created_at')

  // 30일 이내 예정 + 지난 건강 관리 알림 (접종·심장사상충·구충 등 모든 카테고리)
  const petIds = (pets ?? []).map((p: Pet) => p.id)
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let vaccAlerts: CareAlert[] = []
  if (petIds.length > 0) {
    const { data } = await supabase
      .from('vaccination_records')
      .select('pet_id, category, vaccine_name, next_due_on')
      .in('pet_id', petIds)
      .not('next_due_on', 'is', null)
      .lte('next_due_on', soon)
      .order('next_due_on')
    vaccAlerts = (data ?? []) as CareAlert[]
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
      {/* 펫 영역 (요약 카드 + 다른 아이들 목록). 제목·등록은 '내 아이' 탭으로 일원화 */}
      <PetSection pets={(pets ?? []) as Pet[]} vaccAlerts={vaccAlerts} />

      {/* 접종 예정 알림 (선택된 아이는 요약 카드와 중복되어 제외) */}
      <VaccAlerts pets={(pets ?? []) as Pet[]} alerts={vaccAlerts} />

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

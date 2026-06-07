import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge, lifeStageColor, timeAgo, categoryColor } from '@/lib/utils'
import Link from 'next/link'
import type { Pet, PostListItem } from '@/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .eq('user_id', user!.id)
    .order('created_at')

  // 최근 커뮤니티 글 (위젯용)
  const { data: recentPostsData } = await supabase
    .from('post_list')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)
  const recentPosts = (recentPostsData ?? []) as PostListItem[]

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">우리 아이들</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            aria-label="프로필 편집"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
          <Link href="/pets/new" className="btn-primary text-sm py-1.5 px-3">
            + 등록
          </Link>
        </div>
      </div>

      {/* 반려동물 카드 목록 */}
      {!pets || pets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🐶</div>
          <p className="text-gray-500 text-sm">아직 등록된 반려동물이 없어요</p>
          <Link href="/pets/new" className="btn-primary inline-block mt-4 text-sm">
            첫 아이 등록하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(pets as Pet[]).map(pet => {
            const age = calcPetAge(pet.birth_year, pet.birth_month)
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <div className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {pet.photo_url ? (
                      <img src={pet.photo_url} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                    ) : (pet.species === 'cat' ? '🐱' : '🐶')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{pet.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                        {age.lifeStage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {pet.breed?.name_ko} · {age.displayText} · {pet.gender}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* 빠른 메뉴 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">바로가기</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/foods', emoji: '🥩', label: '음식 안전 정보', desc: '먹어도 되는 음식 확인' },
            { href: '/health', emoji: '🏥', label: '건강 가이드', desc: '나이별 주의 질환' },
            { href: '/walk', emoji: '🎾', label: '활동 가이드', desc: '권장 운동량 확인' },
            { href: '/pets/new', emoji: '➕', label: '반려동물 추가', desc: '새 아이 등록하기' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="card hover:shadow-md transition-shadow h-full">
                <div className="text-2xl mb-2">{item.emoji}</div>
                <div className="font-semibold text-sm text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 커뮤니티 글 */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">커뮤니티 최근 글</h2>
            <Link href="/community" className="text-xs text-primary-600 font-medium">
              더보기 →
            </Link>
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

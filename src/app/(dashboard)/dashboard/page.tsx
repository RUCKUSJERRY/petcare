import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge, lifeStageColor, timeAgo, categoryColor } from '@/lib/utils'
import Link from 'next/link'
import type { Pet, PostListItem } from '@/types'
import { SelectedPetSummary } from './_components/SelectedPetSummary'

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

      {/* 선택된 아이 요약 (헤더에서 선택 시 표시) */}
      <SelectedPetSummary
        pets={(pets ?? []) as Pet[]}
        vaccAlerts={vaccAlerts}
      />

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
            const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
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

      {/* 빠른 메뉴 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">바로가기</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/foods', emoji: '🥩', label: '음식 안전 정보', desc: '먹어도 되는 음식 확인' },
            { href: '/health', emoji: '🏥', label: '건강 가이드', desc: '나이별 주의 질환' },
            { href: '/walk', emoji: '🎾', label: '활동 가이드', desc: '권장 운동량 확인' },
            { href: '/community/new', emoji: '✏️', label: '커뮤니티 글쓰기', desc: '이야기 나누기' },
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

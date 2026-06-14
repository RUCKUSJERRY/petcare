import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { CareAlert, Pet, PostListItem } from '@/types'
import { PetSection } from './_components/PetSection'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const t = await getTranslations('dashboard')
  const tCommon = await getTranslations('common')
  const { data: { user } } = await supabase.auth.getUser()

  // 멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환 (공동 관리 아이 포함)
  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .order('created_at')

  // 30일 이내 예정 + 지난 건강 관리 알림 (접종·심장사상충·구충 등 모든 카테고리)
  const petIds = (pets ?? []).map((p: Pet) => p.id)
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let vaccAlerts: CareAlert[] = []
  if (petIds.length > 0) {
    // 같은 관리 항목(아이·카테고리·항목명)은 "가장 최근 시행 기록"만 유효한 일정으로 본다.
    // 더 최근에 다시 시행한 기록이 있으면, 이전 기록의 다음 예정일은 이미 갱신된 과거 일정이므로
    // 대시보드 알림에서 제외한다. (예: 6/13에 건강검진을 다시 했는데 6/10이 예정일이던
    // 이전 기록이 "지남"으로 표시되던 문제 해결)
    const { data } = await supabase
      .from('vaccination_records')
      .select('pet_id, category, vaccine_name, vaccinated_on, next_due_on')
      .in('pet_id', petIds)
      .order('vaccinated_on', { ascending: false })

    type CareRow = CareAlert & { vaccinated_on: string; next_due_on: string | null }
    const latestByLine = new Map<string, CareRow>()
    for (const r of (data ?? []) as CareRow[]) {
      const key = `${r.pet_id}|${r.category}|${r.vaccine_name}`
      // 시행일 내림차순 정렬이므로 각 항목의 첫 등장이 최신 기록
      if (!latestByLine.has(key)) latestByLine.set(key, r)
    }
    vaccAlerts = Array.from(latestByLine.values())
      .filter((a): a is CareAlert & { vaccinated_on: string } => a.next_due_on != null && a.next_due_on <= soon)
      .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))
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
      {/* 펫 영역 (요약 카드 + 다른 아이들 목록 + 건강 일정 알림). 제목·등록은 '내 아이' 탭으로 일원화 */}
      <PetSection pets={(pets ?? []) as Pet[]} vaccAlerts={vaccAlerts} />

      {/* 지도 (실종·동물병원·애견카페/식당) */}
      <Link href="/map" className="card flex items-center gap-3 hover:shadow-md transition-shadow">
        <span className="text-xl" aria-hidden>🗺️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{t('mapTitle')}</p>
          <p className="text-xs text-gray-400">{t('mapDesc')}</p>
        </div>
        <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* 산책 기록 (러닝앱처럼 경로·거리·시간 기록 + 좋은 경로 공유) */}
      <Link href="/walks" className="card flex items-center gap-3 hover:shadow-md transition-shadow">
        <span className="text-xl" aria-hidden>🦮</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{t('walksTitle')}</p>
          <p className="text-xs text-gray-400">{t('walksDesc')}</p>
        </div>
        <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* 건강 일정 전체 보기 (펫이 있을 때 항상 노출) */}
      {pets && pets.length > 0 && (
        <Link
          href="/schedule"
          data-tour="schedule"
          className="card flex items-center gap-3 hover:shadow-md transition-shadow"
        >
          <span className="text-xl" aria-hidden>🗓️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t('scheduleTitle')}</p>
            <p className="text-xs text-gray-400">{t('scheduleDesc')}</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* 최근 커뮤니티 글 */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">{t('communityRecent')}</h2>
            <div className="flex items-center gap-3">
              <Link href="/community" className="text-xs text-gray-400 font-medium">
                {tCommon('more')}
              </Link>
              <Link href="/community/new" className="text-xs text-primary-600 font-semibold">
                {t('write')}
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

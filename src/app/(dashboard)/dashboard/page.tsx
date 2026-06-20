import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor } from '@/lib/utils'
import { PRODUCT_CATEGORIES } from '@/lib/records'
import { activeNextDue } from '@/lib/recurrence'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { CareAlert, Pet, PostListItem, RecordCategory } from '@/types'
import { PetSection } from './_components/PetSection'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const t = await getTranslations('dashboard')
  const tCommon = await getTranslations('common')
  await supabase.auth.getUser()

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
    // 같은 항목 라인(아이·카테고리[·제품명])은 "가장 최근 기록"만 유효한 일정으로 본다.
    // 제품성 카테고리(접종·구충 등)만 제목까지 구분하고, 그 외는 카테고리 단위로 최신 1건.
    const { data } = await supabase
      .from('records')
      .select('id, pet_id, category, title, event_on, next_due_on, recur_rule')
      .in('pet_id', petIds)
      .order('event_on', { ascending: false })

    type Row = { id: string; pet_id: string; category: RecordCategory; title: string; event_on: string; next_due_on: string | null; recur_rule: string | null }
    const todayStr = new Date().toISOString().slice(0, 10)
    const latestByLine = new Map<string, Row>()
    for (const r of (data ?? []) as Row[]) {
      const key = PRODUCT_CATEGORIES.has(r.category)
        ? `${r.pet_id}|${r.category}|${r.title}`
        : `${r.pet_id}|${r.category}`
      if (!latestByLine.has(key)) latestByLine.set(key, r)
    }
    vaccAlerts = Array.from(latestByLine.values())
      .map((r): CareAlert | null => {
        const due = activeNextDue(r.event_on, r.recur_rule, r.next_due_on, todayStr)
        return due ? { pet_id: r.pet_id, category: r.category, title: r.title, next_due_on: due, record_id: r.id, recur_rule: r.recur_rule } : null
      })
      .filter((a): a is CareAlert => a != null && a.next_due_on <= soon)
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

      {/* 케어 비용(지출) 통계 — 펫이 있을 때 */}
      {pets && pets.length > 0 && (
        <Link href="/costs" className="card flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-xl" aria-hidden>🧾</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t('costsTitle')}</p>
            <p className="text-xs text-gray-400">{t('costsDesc')}</p>
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

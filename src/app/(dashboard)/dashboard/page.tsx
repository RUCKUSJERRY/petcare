import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor, todayKST, addDays, daysUntil } from '@/lib/utils'
import { PRODUCT_CATEGORIES } from '@/lib/records'
import { activeNextDue } from '@/lib/recurrence'
import { getSmartRecommendations, type CareDueItem } from '@/lib/affiliate'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { CareAlert, Pet, PostListItem, RecordCategory, Species } from '@/types'
import { PetSection } from './_components/PetSection'
import { PremiumUpsellCard } from '@/components/ui/PremiumUpsellCard'
import { SmartAffiliateCard } from '@/components/ui/SmartAffiliateCard'

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
  const todayStr = todayKST()
  const soon = addDays(todayStr, 30)

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

  // 기록 기반 맞춤 제휴 추천 — 임박한 케어 일정 + 꾸준한 식사 기록을 신호로 사용
  const speciesById = new Map((pets ?? []).map((p: Pet) => [p.id, p.species]))
  const dueSoon: CareDueItem[] = vaccAlerts.flatMap(a => {
    const species = speciesById.get(a.pet_id)
    if (!species) return []
    const d = daysUntil(a.next_due_on, todayStr)
    return d <= 14 ? [{ species, category: a.category, daysUntil: d }] : []
  })

  let mealLogs7d = 0
  if (petIds.length > 0) {
    const { count } = await supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .in('pet_id', petIds)
      .eq('category', '식사')
      .gte('event_on', addDays(todayStr, -7))
    mealLogs7d = count ?? 0
  }
  // 사료 추천 종은 보유 반려동물 중 다수 종
  const speciesTally = (pets ?? []).reduce(
    (acc: Record<Species, number>, p: Pet) => { acc[p.species] = (acc[p.species] ?? 0) + 1; return acc },
    { dog: 0, cat: 0 } as Record<Species, number>,
  )
  const mealSpecies: Species = speciesTally.cat > speciesTally.dog ? 'cat' : 'dog'
  const smartRecs = getSmartRecommendations({
    dueSoon,
    meal: petIds.length > 0 ? { species: mealSpecies, logs7d: mealLogs7d } : undefined,
  })

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

      {/* 프리미엄 업셀 (무료 사용자만, 닫기 가능) */}
      <PremiumUpsellCard />

      {/* 기록 기반 맞춤 제휴 추천 (임박 일정·식사 루틴) */}
      <SmartAffiliateCard recs={smartRecs} />

      {/* 바로가기 — 단일 목적 페이지를 한 줄에 압축해 스크롤·중복을 줄임 */}
      <div className="grid grid-cols-2 gap-3">
        {pets && pets.length > 0 && (
          <QuickTile href="/schedule" icon="🗓️" label={t('scheduleTitle')} dataTour="schedule" />
        )}
        {pets && pets.length > 0 && (
          <QuickTile href="/costs" icon="🧾" label={t('costsTitle')} />
        )}
        <QuickTile href="/walks" icon="🦮" label={t('walksTitle')} />
        <QuickTile href="/map" icon="🗺️" label={t('mapTitle')} />
      </div>

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

/** 홈 바로가기 타일 — 아이콘 + 라벨의 작은 카드 (세로 스택 대신 그리드로 압축) */
function QuickTile({
  href, icon, label, dataTour,
}: {
  href: string
  icon: string
  label: string
  dataTour?: string
}) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className="card flex items-center gap-2.5 py-3.5 hover:shadow-md transition-shadow"
    >
      <span className="text-xl shrink-0" aria-hidden>{icon}</span>
      <span className="text-sm font-semibold text-gray-900 truncate">{label}</span>
    </Link>
  )
}

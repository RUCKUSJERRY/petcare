import { createServerSupabaseClient } from '@/lib/supabase/server'
import { timeAgo, categoryColor, todayKST, addDays, daysUntil, computeLogStreak } from '@/lib/utils'
import { DAILY_LOG_CATEGORIES } from '@/lib/records'
import { computeUpcoming, type ScheduleRow } from '@/lib/schedule'
import { getSmartRecommendations, type CareDueItem } from '@/lib/affiliate'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import type { CareAlert, Pet, PostListItem, Species } from '@/types'
import { PetSection } from './_components/PetSection'
import { HomeGreeting } from './_components/HomeGreeting'
import { TodayChecklist } from './_components/TodayChecklist'
import { TodayInfoCard } from './_components/TodayInfoCard'
import { FoodSafetySearch } from './_components/FoodSafetySearch'
import { WeeklyReportCard } from './_components/WeeklyReportCard'
import { MonthlyRecapCard } from './_components/MonthlyRecapCard'
import { PremiumUpsellCard } from '@/components/ui/PremiumUpsellCard'
import { PushNudge } from '@/components/ui/PushNudge'
import { SmartAffiliateCard } from '@/components/ui/SmartAffiliateCard'

// 연속 기록 계산 시 거슬러 올라갈 최대 창(일). streak-reminder cron 과 동일 기준 —
// 이보다 긴 연속은 이 값으로 제한되지만 홈 배지 목적엔 충분하고, 조회 행 수를 합리적으로 제한한다.
const STREAK_WINDOW_DAYS = 60

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const t = await getTranslations('dashboard')
  const tCommon = await getTranslations('common')

  const todayStr = todayKST()
  const soon = addDays(todayStr, 30)

  // 반려동물 목록·최근 커뮤니티 글·보호자 프로필은 서로 독립적이라 병렬로 조회한다.
  // (멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환 — 공동 관리 아이 포함)
  // getUser 는 세션 갱신도 겸하므로 여기서 한 번만 호출해 재사용한다.
  const { data: { user } } = await supabase.auth.getUser()
  const [petsRes, recentPostsRes, profileRes] = await Promise.all([
    supabase.from('pets').select('*, breed:breeds(*)').order('created_at'),
    supabase.from('post_list').select('*').order('created_at', { ascending: false }).limit(3),
    // 홈 인사말에 쓸 보호자 이름 (없으면 이름 없는 인사로 폴백)
    user ? supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const ownerName = (profileRes.data as { display_name?: string } | null)?.display_name ?? null
  const pets = petsRes.data
  // 조회 실패(RLS/네트워크)로 data 가 null 이면, 아이가 있는 사용자에게도 '첫 아이 등록'
  // 온보딩이 떠 버린다 — 성공(빈 배열)과 실패(null+error)를 구분해 에러 상태를 전달한다.
  const petsLoadError = !!petsRes.error
  const petIds = (pets ?? []).map((p: Pet) => p.id)

  // 30일 이내 예정 + 지난 건강 관리 알림 (접종·심장사상충·구충 등 모든 카테고리)
  // 라인별 최신 기록 → 다음 예정일 산출은 일정 화면과 동일한 공용 로직(computeUpcoming)을 쓴다.
  let vaccAlerts: CareAlert[] = []
  // 아이별 '연속 기록일(streak)' — 매일 재방문·기록을 유도하는 리텐션 지표.
  const streakByPet: Record<string, number> = {}
  if (petIds.length > 0) {
    // 예정 알림: 모든 기록을 통째로 불러오지 않고, 필요한 최소 상위집합(라인별 최신 + 미완료 후속
    // 예정)만 RPC 로 받아 computeUpcoming 에 넣는다. computeUpcoming 이 여전히 최종 판정의 단일 출처.
    const { data: upData, error: upErr } = await supabase.rpc('pet_upcoming_rows', { p_pet_ids: petIds })
    let upRows: (ScheduleRow & { created_at: string })[]
    if (upErr) {
      // RPC 미적용(마이그레이션 018 반영 전) 등으로 실패하면, 예전처럼 전체 조회로 안전하게
      // 폴백해 알림 누락을 막는다. (배포-마이그레이션 순서에 무관하게 동작)
      const { data } = await supabase
        .from('records')
        .select('id, pet_id, category, title, event_on, next_due_on, recur_rule, created_at')
        .in('pet_id', petIds)
        .order('event_on', { ascending: false })
        .order('created_at', { ascending: false })
      upRows = (data ?? []) as (ScheduleRow & { created_at: string })[]
    } else {
      // computeUpcoming 은 event_on 내림차순(동점 시 created_at 내림차순) 정렬을 전제한다.
      upRows = ((upData ?? []) as (ScheduleRow & { created_at: string })[])
        .sort((a, b) => b.event_on.localeCompare(a.event_on) || b.created_at.localeCompare(a.created_at))
    }

    vaccAlerts = computeUpcoming(upRows)
      .filter(u => u.next_due_on <= soon)
      .map((u): CareAlert => ({
        pet_id: u.pet_id, category: u.category, title: u.title,
        next_due_on: u.next_due_on, record_id: u.record_id, recur_rule: u.recur_rule,
      }))
      .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))

    // 연속 기록: 생활기록 카테고리만, 최근 STREAK_WINDOW_DAYS 로 범위를 좁혀 조회(무제한 방지).
    // 이보다 긴 연속은 이 창으로 제한되지만 홈 배지 목적엔 충분(streak-reminder cron 과 동일 기준).
    const { data: logData } = await supabase
      .from('records')
      .select('pet_id, event_on')
      .in('pet_id', petIds)
      .in('category', DAILY_LOG_CATEGORIES)
      .gte('event_on', addDays(todayStr, -STREAK_WINDOW_DAYS))
    const logDatesByPet = new Map<string, Set<string>>()
    for (const r of (logData ?? []) as { pet_id: string; event_on: string }[]) {
      let set = logDatesByPet.get(r.pet_id)
      if (!set) { set = new Set(); logDatesByPet.set(r.pet_id, set) }
      set.add(r.event_on)
    }
    for (const pid of petIds) {
      streakByPet[pid] = computeLogStreak(logDatesByPet.get(pid) ?? new Set(), todayStr)
    }
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
      // 미래로 예약(선입력)된 기록이 최근 7일 식사 신호를 부풀리지 않도록 상한을 건다.
      // (event_on 은 사용자가 고르는 날짜라 미래일 수 있음 — 앱 전반의 7일 집계와 동일 기준)
      .lte('event_on', todayStr)
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

  // 최근 커뮤니티 글 (위젯용) — 위에서 병렬로 미리 조회함
  const recentPosts = (recentPostsRes.data ?? []) as PostListItem[]

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 개인화 인사말 — 시간대 + 보호자 이름으로 매일 따뜻하게 맞이(재방문 습관 강화) */}
      <HomeGreeting name={ownerName} />

      {/* 알림 켜기 넛지 — 아직 푸시를 구독하지 않은 사용자에게만 가볍게 권한다(재방문 핵심 장치).
          이미 켜짐/미지원/닫음 상태면 스스로 숨는다(클라이언트 판단). 첫 아이 등록(온보딩) CTA와
          겹치지 않도록 아이가 있을 때만 노출한다. */}
      {pets && pets.length > 0 && <PushNudge />}

      {/* 펫 영역 (요약 카드 + 다른 아이들 목록 + 건강 일정 알림). 제목·등록은 '내 아이' 탭으로 일원화 */}
      <PetSection pets={(pets ?? []) as Pet[]} vaccAlerts={vaccAlerts} streakByPet={streakByPet} loadError={petsLoadError} />

      {/* 오늘의 돌봄 체크 — 매일 챙기는 핵심 4가지(밥·물·배변·산책)를 체크리스트로.
          하루 습관 루프를 '목표 달성'으로 만들어 재방문·기록 지속(리텐션)을 유도한다.
          선택된 아이가 있을 때만 스스로 노출된다(클라이언트). */}
      {pets && pets.length > 0 && <TodayChecklist />}

      {/* 바로가기 — 하단 탭에 이미 있는 목적지(일정·지도)를 다시 얹지 않고, '숨어 있어 찾기 어려운'
          화면(성취·비용)과 가장 잦은 의도(산책 지금 시작)를 홈 상단부에 노출한다.
          (성취·비용·산책은 하단 탭 진입점이 없어 발견성이 낮았다.) 예전엔 이 바로가기가 홈 맨
          아래, 그것도 프리미엄 업셀·제휴 추천 카드 '아래'에 있어, 매일 쓰는 이동 동선이 홍보 카드
          뒤로 밀려 있었다 — 오늘의 돌봄 바로 밑으로 올려 한 번의 스크롤 안에 닿게 한다. */}
      <div className="grid grid-cols-2 gap-3">
        {pets && pets.length > 0 ? (
          <>
            {/* 성취(레벨·뱃지)는 예전엔 주간 리포트 카드의 배지 하나로만 들어갈 수 있어
                거의 발견되지 않았다 — 홈 타일로 상시 진입점을 준다(리텐션 시스템 노출).
                건강(/health)은 '오늘의 정보' 카드에서 상시 연결되므로 타일 중복을 제거했다. */}
            <QuickTile href="/achievements" icon="🏅" label={t('achievementsTitle')} />
            <QuickTile href="/costs" icon="🧾" label={t('costsTitle')} />
            {/* 홈에서 가장 잦은 산책 의도는 '지금 시작'이라, 목록을 거치지 않고 바로 산책 시작 화면으로.
                autostart=1 로 넘겨, GPS가 준비됐고 복구할 세션이 없으면 idle 한 단계를 건너뛰고 자동 시작한다. */}
            <QuickTile href="/walks/track?autostart=1" icon="🦮" label={t('walksTitle')} />
          </>
        ) : (
          // 아직 아이가 없으면 성취·건강·비용은 의미가 없어(아이 기준) 지도·산책만 노출한다.
          <>
            <QuickTile href="/walks/track?autostart=1" icon="🦮" label={t('walksTitle')} />
            <QuickTile href="/map" icon="🗺️" label={t('mapTitle')} />
          </>
        )}
      </div>

      {/* 지난달 회고 — 새 달 초반(1~7일)에만 지난 한 달을 돌아보게 하는 카드(월초 재방문 계기 +
          브랜드 이미지 공유로 자연 유입). 노출 창이 아니거나 활동이 없으면 스스로 숨김. */}
      {pets && pets.length > 0 && <MonthlyRecapCard />}

      {/* 이번 주 리포트 — 최근 7일 활동 요약 + 성장 레벨. 재방문·체류·게임화(리텐션) 유도.
          선택된 아이 기준으로 클라이언트에서 조회(활동/누적이 0이면 스스로 숨김). */}
      {pets && pets.length > 0 && <WeeklyReportCard />}

      {/* 오늘의 정보 — '오늘의 건강 포인트'와 '오늘의 케어 팁'을 하나의 카드에서 세그먼트로 전환.
          성격이 겹치던 두 정보 카드를 합쳐 홈 스크롤·중복을 줄이되 노출은 유지(정보 고도화). */}
      {pets && pets.length > 0 && <TodayInfoCard />}

      {/* 음식 안전 빠른검색 — "이거 먹어도 돼?"를 홈에서 바로 검색해 /foods 안전 결과로 딥링크.
          가장 잦은 정보 질의를 최상위로 끌어올려 재방문·체류를 유도한다. */}
      {pets && pets.length > 0 && <FoodSafetySearch />}

      {/* 프리미엄 업셀 (무료 사용자만, 닫기 가능) */}
      <PremiumUpsellCard />

      {/* 기록 기반 맞춤 제휴 추천 (임박 일정·식사 루틴) */}
      <SmartAffiliateCard recs={smartRecs} />

      {/* 최근 커뮤니티 글 */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500">{t('communityRecent')}</h2>
            <div className="flex items-center gap-3">
              <Link href="/community" className="text-xs text-gray-500 font-medium">
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

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * '더보기' 허브 — 하단탭에 상시 자리가 없던 화면들을 한곳에 모은다.
 * 예전엔 비용·성취·건강 등이 홈 타일로만 접근돼(스크롤하면 사라짐) 발견성이 낮았고,
 * 📚'정보' 탭은 실제 목적지(음식)와 아이콘·라벨이 어긋났다. 이 허브가 그 진입점을 일원화한다.
 */

type Item = { href: string; icon: string; key: string }

const INFO_ITEMS: Item[] = [
  { href: '/chat', icon: '🤖', key: 'chatbot' },
  { href: '/foods', icon: '🍽️', key: 'foods' },
  { href: '/health', icon: '🩺', key: 'health' },
  { href: '/symptoms', icon: '🩹', key: 'symptoms' },
  { href: '/walk', icon: '🎾', key: 'activity' },
  { href: '/care', icon: '🧼', key: 'care' },
]

const ACTIVITY_ITEMS: Item[] = [
  { href: '/costs', icon: '🧾', key: 'costs' },
  { href: '/achievements', icon: '🏅', key: 'achievements' },
  { href: '/walks', icon: '🦮', key: 'walks' },
  { href: '/lost', icon: '🐾', key: 'lost' },
  // 지도(주변 병원·약국·카페)는 예전 하단탭이었으나 '내 아이' 탭 승격으로 이곳으로 옮겨왔다 —
  // 허브에 상시 진입점을 둬 지도 탭 제거로 발견성이 낮아지지 않게 한다(지도/실종/산책 섹션 스트립과 연결).
  { href: '/map', icon: '🗺️', key: 'map' },
]

export default async function MorePage() {
  const t = await getTranslations('more')

  // 공동 관리(초대·구성원) 화면은 아이 상세(/pets/[id]) 하단에 있다. 예전엔 이 타일이 목록
  // (/pets)으로만 가 "어느 아이?"를 한 번 더 고르고 스크롤해야 구성원 화면에 닿았다. 아이가
  // 1마리면 그 아이의 구성원 섹션으로 바로 딥링크해 한 단계를 없앤다(여러 마리면 목록에서 선택).
  const supabase = await createServerSupabaseClient()
  const { data: petRows } = await supabase.from('pets').select('id').order('created_at')
  const pets = petRows ?? []
  const coCareHref = pets.length === 1 ? `/pets/${pets[0].id}#members` : '/pets'

  // 계정·설정 — 공동 관리(초대)가 아이 상세 화면 맨 아래에만, 알림·프로필 설정이 헤더의
  // 라벨 없는 사람 아이콘 뒤에만 있어 발견성이 낮았다. 허브에 상시 진입점을 둔다.
  const accountItems: Item[] = [
    { href: coCareHref, icon: '👨‍👩‍👧', key: 'coCare' },
    { href: '/profile', icon: '⚙️', key: 'settings' },
  ]

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>

      <Section title={t('sectionInfo')} items={INFO_ITEMS} t={t} />
      <Section title={t('sectionActivity')} items={ACTIVITY_ITEMS} t={t} />
      <Section title={t('sectionAccount')} items={accountItems} t={t} />
    </div>
  )
}

function Section({
  title, items, t,
}: {
  title: string
  items: Item[]
  t: (k: string) => string
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map(it => (
          <Link
            key={it.key}
            href={it.href}
            className="card flex items-start gap-3 py-3.5 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl shrink-0" aria-hidden>{it.icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{t(it.key)}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{t(`${it.key}Desc`)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

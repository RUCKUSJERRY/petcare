import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

/**
 * '더보기' 허브 — 하단탭에 상시 자리가 없던 화면들을 한곳에 모은다.
 * 예전엔 비용·성취·건강 등이 홈 타일로만 접근돼(스크롤하면 사라짐) 발견성이 낮았고,
 * 📚'정보' 탭은 실제 목적지(음식)와 아이콘·라벨이 어긋났다. 이 허브가 그 진입점을 일원화한다.
 */

type Item = { href: string; icon: string; key: string }

const INFO_ITEMS: Item[] = [
  { href: '/foods', icon: '🍽️', key: 'foods' },
  { href: '/health', icon: '🩺', key: 'health' },
  { href: '/walk', icon: '🎾', key: 'activity' },
  { href: '/care', icon: '🧼', key: 'care' },
]

const ACTIVITY_ITEMS: Item[] = [
  { href: '/costs', icon: '🧾', key: 'costs' },
  { href: '/achievements', icon: '🏅', key: 'achievements' },
  { href: '/walks', icon: '🦮', key: 'walks' },
  { href: '/lost', icon: '🐾', key: 'lost' },
]

// 계정·설정 — 예전엔 공동 관리(초대)가 아이 상세 화면 맨 아래에만, 알림·프로필 설정이 헤더의
// 라벨 없는 사람 아이콘 뒤에만 있어 발견성이 낮았다. 허브에 상시 진입점을 둔다.
const ACCOUNT_ITEMS: Item[] = [
  { href: '/pets', icon: '👨‍👩‍👧', key: 'coCare' },
  { href: '/profile', icon: '⚙️', key: 'settings' },
]

export default async function MorePage() {
  const t = await getTranslations('more')

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>

      <Section title={t('sectionInfo')} items={INFO_ITEMS} t={t} />
      <Section title={t('sectionActivity')} items={ACTIVITY_ITEMS} t={t} />
      <Section title={t('sectionAccount')} items={ACCOUNT_ITEMS} t={t} />
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
              <div className="text-xs text-gray-400 mt-0.5 truncate">{t(`${it.key}Desc`)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

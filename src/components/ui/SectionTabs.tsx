'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * 하단탭 하나에 묶인 형제 페이지 사이를 바로 오갈 수 있는 가로 탭 스트립.
 * - '정보' 탭(음식/건강/활동), '지도' 탭(지도/실종/산책)처럼 하위 페이지가 묶여 있지만
 *   진입하면 형제 메뉴를 알기 어렵던 발견성 문제를 해결한다.
 * - 각 페이지 상단(PageHeader 바로 아래)에 한 줄 추가해 사용한다.
 */
const SECTIONS = {
  info: [
    { href: '/foods', key: 'foods', icon: '🍽️' },
    { href: '/health', key: 'health', icon: '🩺' },
    { href: '/symptoms', key: 'symptoms', icon: '🩹' },
    { href: '/walk', key: 'activity', icon: '🎾' },
    { href: '/care', key: 'care', icon: '🧼' },
  ],
  map: [
    { href: '/map', key: 'map', icon: '🗺️' },
    { href: '/lost', key: 'lost', icon: '🐾' },
    { href: '/walks', key: 'walks', icon: '🦮' },
  ],
  // 비용·성취는 더보기 '활동' 그룹으로 묶여 있으면서도 상단 스트립이 없어, 둘을 오가려면 매번
  // 더보기를 거쳐야 했다(발견성 낮음). 두 화면에만 서로를 잇는 스트립을 둔다. 산책·실종은 이미
  // '지도' 스트립으로 상호 이동이 되므로 이중 소속(혼선)을 피해 여기 넣지 않는다.
  activity: [
    { href: '/costs', key: 'costsTab', icon: '🧾' },
    { href: '/achievements', key: 'achievementsTab', icon: '🏅' },
  ],
} as const

// 경로 세그먼트 단위 매칭: '/walk'가 '/walks'를 잘못 포함하지 않도록 한다. (BottomNav와 동일 규칙)
const matchPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/')

export function SectionTabs({ section }: { section: keyof typeof SECTIONS }) {
  const pathname = usePathname()
  const t = useTranslations('sectionTabs')

  return (
    <nav
      aria-label={t('aria')}
      className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-0.5"
    >
      {SECTIONS[section].map(tab => {
        const active = matchPath(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium shrink-0 border transition-colors',
              active
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            )}
          >
            <span aria-hidden>{tab.icon}</span>
            {t(tab.key)}
          </Link>
        )
      })}
    </nav>
  )
}

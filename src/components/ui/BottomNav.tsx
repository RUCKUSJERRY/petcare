'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// 하단 5탭. '더보기'는 하단탭에 상시 자리가 없던 화면들(음식·건강·활동·생활관리 정보, 비용,
// 성취 등)을 모으는 허브(/more)로 보낸다. 예전엔 📚'정보' 탭이 실제로는 음식(/foods)으로 떨어져
// 아이콘·라벨과 목적지가 어긋났고, 비용·성취·건강은 홈 타일로만 접근돼 발견성이 낮았다.
const navItems = [
  { href: '/dashboard', key: 'home', icon: '🏠', tour: 'nav-dashboard' },
  { href: '/map', key: 'map', icon: '🗺️', tour: 'nav-map' },
  { href: '/schedule', key: 'schedule', icon: '🗓️', tour: 'nav-schedule' },
  { href: '/community', key: 'community', icon: '💬', tour: 'nav-community' },
  { href: '/more', key: 'more', icon: '⋯', tour: 'nav-more' },
] as const

// 경로 세그먼트 단위 매칭: '/walk'가 '/walks'를 잘못 포함하지 않도록 한다.
// (예: matchPath('/walks', '/walk') === false, matchPath('/walk/123', '/walk') === true)
const matchPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/')

// '더보기' 탭에 묶이는 하위 페이지들 — 허브(/more)에서 진입하는 정보·비용·성취 화면.
// (레거시 /info 허브 경로도 포함해 예전 링크·북마크가 여전히 '더보기'로 표시되게 한다.)
const MORE_SUBPATHS = ['/more', '/foods', '/health', '/walk', '/care', '/info', '/costs', '/achievements']
// '지도' 탭에 묶이는 하위 페이지 (실종 신고/제보·산책하기는 지도 탭에서 진입)
const MAP_SUBPATHS = ['/lost', '/walks']

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav aria-label={t('label')} className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const isActive =
            item.key === 'more'
              ? MORE_SUBPATHS.some(p => matchPath(pathname, p))
              : item.href === '/map'
                ? matchPath(pathname, '/map') || MAP_SUBPATHS.some(p => matchPath(pathname, p))
                : matchPath(pathname, item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              data-tour={item.tour}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-xs transition-colors',
                isActive ? 'text-primary-600 font-semibold' : 'text-gray-500'
              )}
            >
              {/* 활성 표시: 상단 인디케이터 바 */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary-500" />
              )}
              {/* 활성 시 아이콘 뒤 둥근 배경으로 직관적으로 강조 */}
              <span
                className={cn(
                  'flex items-center justify-center w-9 h-7 rounded-full text-xl leading-none transition-colors',
                  isActive && 'bg-primary-50'
                )}
              >
                {item.icon}
              </span>
              <span>{t(item.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

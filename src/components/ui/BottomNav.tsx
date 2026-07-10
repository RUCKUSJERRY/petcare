'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', key: 'home', icon: '🏠' },
  { href: '/info', key: 'info', icon: '📚' },
  { href: '/map', key: 'map', icon: '🗺️' },
  { href: '/schedule', key: 'schedule', icon: '🗓️' },
  { href: '/community', key: 'community', icon: '💬' },
] as const

// 경로 세그먼트 단위 매칭: '/walk'가 '/walks'를 잘못 포함하지 않도록 한다.
// (예: matchPath('/walks', '/walk') === false, matchPath('/walk/123', '/walk') === true)
const matchPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/')

// 정보 탭에 묶이는 하위 페이지 (BottomNav에서 '정보'를 활성화)
const INFO_SUBPATHS = ['/foods', '/health', '/walk', '/care']
// 지도 탭에 묶이는 하위 페이지 (실종 신고/제보·산책하기는 지도 탭에서 진입)
const MAP_SUBPATHS = ['/lost', '/walks']
// 일정 탭에 묶이는 하위 페이지 (케어 비용은 기록/일정에서 파생 — 활성 탭이 없던 문제 해결)
const SCHEDULE_SUBPATHS = ['/costs']

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const isActive =
            item.href === '/info'
              ? matchPath(pathname, '/info') || INFO_SUBPATHS.some(p => matchPath(pathname, p))
              : item.href === '/map'
                ? matchPath(pathname, '/map') || MAP_SUBPATHS.some(p => matchPath(pathname, p))
                : item.href === '/schedule'
                  ? matchPath(pathname, '/schedule') || SCHEDULE_SUBPATHS.some(p => matchPath(pathname, p))
                  : matchPath(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href.slice(1)}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-xs transition-colors',
                isActive ? 'text-primary-600 font-semibold' : 'text-gray-400'
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

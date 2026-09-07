'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// 하단 5탭. 반려동물 관리 앱의 가장 잦은 일상 화면인 '내 아이'(/pets)를 상시 탭으로 승격한다.
// 예전엔 매일 쓰는 내 아이 목록이 헤더의 라벨 없는 🐾 아이콘 뒤에만 있어 발견성이 낮았고,
// 상대적으로 덜 쓰는 '지도'(주변 병원·약국·카페 찾기)가 상위 탭 한 자리를 차지했다. 지도는
// '더보기' 허브(위치·활동 그룹)로 옮겨 여전히 한 번에 닿게 하고, 그 자리에 '내 아이'를 둔다.
// '더보기'는 하단탭에 상시 자리가 없는 화면들(음식·건강·활동·생활관리 정보, 비용·성취, 지도·실종·산책)을
// 모으는 허브(/more)다.
const navItems = [
  { href: '/dashboard', key: 'home', icon: '🏠', tour: 'nav-dashboard' },
  { href: '/pets', key: 'pets', icon: '🐾', tour: 'nav-pets' },
  { href: '/schedule', key: 'schedule', icon: '🗓️', tour: 'nav-schedule' },
  { href: '/community', key: 'community', icon: '💬', tour: 'nav-community' },
  { href: '/more', key: 'more', icon: '⋯', tour: 'nav-more' },
] as const

// 경로 세그먼트 단위 매칭: '/walk'가 '/walks'를 잘못 포함하지 않도록 한다.
// (예: matchPath('/walks', '/walk') === false, matchPath('/walk/123', '/walk') === true)
const matchPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(prefix + '/')

// '더보기' 탭에 묶이는 하위 페이지들 — 허브(/more)에서 진입하는 정보·비용·성취·위치(지도/실종/산책) 화면.
// 지도(/map)·실종(/lost)·산책기록(/walks)은 예전 '지도' 탭 소속이었으나, 지도 탭을 '내 아이'로
// 교체하면서 '더보기' 그룹으로 옮겼다(진입은 /more 허브 + 각 화면 상단 지도 섹션 스트립으로 유지).
// (레거시 /info 허브 경로도 포함해 예전 링크·북마크가 여전히 '더보기'로 표시되게 한다.)
const MORE_SUBPATHS = ['/more', '/foods', '/health', '/symptoms', '/walk', '/walks', '/care', '/info', '/costs', '/achievements', '/map', '/lost']

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

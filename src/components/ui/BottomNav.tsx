'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: '홈', icon: '🏠' },
  { href: '/info', label: '정보', icon: '📚' },
  { href: '/map', label: '지도', icon: '🗺️' },
  { href: '/community', label: '커뮤니티', icon: '💬' },
]

// 정보 탭에 묶이는 하위 페이지 (BottomNav에서 '정보'를 활성화)
const INFO_SUBPATHS = ['/foods', '/health', '/walk']
// 지도 탭에 묶이는 하위 페이지 (실종 신고/제보는 지도 탭에서 진입)
const MAP_SUBPATHS = ['/lost']

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const isActive =
            item.href === '/info'
              ? pathname.startsWith('/info') || INFO_SUBPATHS.some(p => pathname.startsWith(p))
              : item.href === '/map'
                ? pathname.startsWith('/map') || MAP_SUBPATHS.some(p => pathname.startsWith(p))
                : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.href.slice(1)}`}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors',
                isActive ? 'text-primary-600 font-semibold' : 'text-gray-400'
              )}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

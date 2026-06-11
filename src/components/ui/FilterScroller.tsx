'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * 가로 스크롤되는 필터 칩 행을 감싸는 래퍼.
 * - 스크롤바를 숨기고(scrollbar-none)
 * - 가려진 칩이 더 있으면 해당 방향(◀/▶) 화살표를 표시해 더 있다는 걸 알려준다.
 * 화살표를 누르면 그 방향으로 스크롤된다.
 *
 * 화면 끝까지 칩을 흘려보내기 위해 내부 스크롤 영역에 -mx-4 px-4 를 적용한다.
 */
export function FilterScroller({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = () => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // 칩 렌더 직후 폭 계산이 어긋나는 경우를 위해 한 틱 뒤 재계산
    const t = setTimeout(update, 80)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      clearTimeout(t)
    }
  }, [])

  const nudge = (dx: number) => ref.current?.scrollBy({ left: dx, behavior: 'smooth' })

  return (
    <div className={cn('relative', className)}>
      <div ref={ref} className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
        {children}
      </div>

      {/* 왼쪽에 가려진 칩이 있을 때 */}
      {canLeft && (
        <button
          type="button"
          onClick={() => nudge(-180)}
          aria-label="이전 필터 보기"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-full pr-5 pl-1 flex items-center bg-gradient-to-r from-white via-white to-transparent text-gray-500"
        >
          <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-xs">◀</span>
        </button>
      )}

      {/* 오른쪽에 가려진 칩이 더 있을 때 */}
      {canRight && (
        <button
          type="button"
          onClick={() => nudge(180)}
          aria-label="다음 필터 보기"
          className="absolute right-0 top-1/2 -translate-y-1/2 h-full pl-5 pr-1 flex items-center bg-gradient-to-l from-white via-white to-transparent text-gray-500"
        >
          <span className="w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center text-xs">▶</span>
        </button>
      )}
    </div>
  )
}

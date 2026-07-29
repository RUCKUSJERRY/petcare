import type { ReactNode } from 'react'

/**
 * 리스트/조회 화면의 빈 상태·에러 상태를 일관된 모양으로 보여주는 공통 컴포넌트.
 * 기존에 화면마다 제각각이던 `card text-center py-12 …` 마크업을 대체한다.
 *
 * - variant 'empty'  : 데이터가 없을 때(기본)
 * - variant 'error'  : 불러오기 실패 — 아이콘이 없으면 ⚠️ 기본값 사용
 * - action           : 하단 CTA(링크/버튼 등)를 자유롭게 배치
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  variant = 'empty',
  className = '',
}: {
  icon?: ReactNode
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  variant?: 'empty' | 'error'
  className?: string
}) {
  const resolvedIcon = icon ?? (variant === 'error' ? '⚠️' : '📭')
  return (
    <div className={`card text-center py-12 text-gray-500 space-y-2 ${className}`}>
      <div className="text-4xl" aria-hidden>{resolvedIcon}</div>
      <p className={variant === 'error' ? 'text-red-500' : ''}>{title}</p>
      {hint && <p className="text-xs px-6">{hint}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

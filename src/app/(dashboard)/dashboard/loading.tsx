import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 홈(대시보드) 로딩 스켈레톤.
 * 서버 컴포넌트가 여러 쿼리를 기다리는 동안 빈 화면 대신 골격을 즉시 보여줘 체감 속도를 높인다.
 * 실제 화면 구성(선택 아이 요약 카드 → 알림 → 바로가기 그리드 → 최근 글)에 맞춘다.
 */
export default function DashboardLoading() {
  return (
    <div className="px-4 py-6 space-y-6">
      {/* 선택 아이 요약 카드 */}
      <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>

      {/* 건강 일정 알림 */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* 바로가기 그리드 (2열) */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </div>

      {/* 최근 커뮤니티 글 */}
      <CardSkeletonList count={3} />
    </div>
  )
}

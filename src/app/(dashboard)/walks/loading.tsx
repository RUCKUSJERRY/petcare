import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 산책 기록 화면 로딩 스켈레톤.
 * 헤더 + 지도 섹션 탭 스트립 + 주간 목표 카드 + 내/공유 탭 + 산책 카드 골격을 즉시 보여준다.
 */
export default function WalksLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-24" />
      </div>
      {/* 지도 섹션 탭(지도·실종·산책) */}
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      {/* 주간 산책 목표 카드 */}
      <Skeleton className="h-24 w-full rounded-2xl" />
      {/* 내 산책 / 공유 탭 */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <CardSkeletonList count={4} />
    </div>
  )
}

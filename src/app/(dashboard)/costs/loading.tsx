import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 비용 화면 로딩 스켈레톤.
 * 헤더 + 아이 범위 토글 + 지출 요약 카드 + 내역 카드 골격을 즉시 보여준다.
 */
export default function CostsLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-9 w-40 rounded-full" />
      {/* 지출 요약 카드 */}
      <Skeleton className="h-28 w-full rounded-2xl" />
      <CardSkeletonList count={4} />
    </div>
  )
}

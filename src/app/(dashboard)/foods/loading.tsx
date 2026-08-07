import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 음식 가이드 화면 로딩 스켈레톤.
 * 헤더 + 정보 섹션 탭 스트립 + 주제 탭 + 가이드 카드 골격을 즉시 보여준다.
 */
export default function FoodsLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-24" />
      </div>
      {/* 정보 섹션 탭(음식·건강·활동·생활관리) */}
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      {/* 주제 탭 */}
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>
      <CardSkeletonList count={5} />
    </div>
  )
}

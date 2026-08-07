import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 건강 정보 화면 로딩 스켈레톤.
 * 헤더 + 정보 섹션 탭 스트립 + 검색바 + 가이드 카드 골격을 즉시 보여준다.
 */
export default function HealthLoading() {
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
      {/* 검색바 */}
      <Skeleton className="h-10 w-full rounded-lg" />
      <CardSkeletonList count={5} />
    </div>
  )
}

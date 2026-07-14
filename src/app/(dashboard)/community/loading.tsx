import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 커뮤니티 목록 로딩 스켈레톤.
 * 서버 컴포넌트가 글 목록을 기다리는 동안 검색바·카테고리 필터·글 카드 골격을 즉시 보여준다.
 */
export default function CommunityLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <CardSkeletonList count={5} />
    </div>
  )
}

import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 커뮤니티 글 상세 로딩 스켈레톤.
 * 목록에서 글을 눌렀을 때 이전 화면이 그대로 멈춘 것처럼 보이지 않게
 * 제목·작성자·본문·댓글 영역의 골격을 즉시 보여준다.
 */
export default function PostDetailLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="pt-2">
        <CardSkeletonList count={2} />
      </div>
    </div>
  )
}

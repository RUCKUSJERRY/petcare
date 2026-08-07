import { Skeleton, CardSkeletonList } from '@/components/ui/Skeleton'

/**
 * 일정 화면 로딩 스켈레톤.
 * 라우트 전환 중(청크 로드·마운트) 빈 프레임 대신 헤더 + 아이 범위 토글 + 일정 카드 골격을
 * 즉시 보여줘 체감 속도를 높인다. (마운트 후에는 화면 내부 스켈레톤이 이어받는다.)
 */
export default function ScheduleLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      {/* PageHeader: 뒤로가기 + 제목 */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-24" />
      </div>
      {/* 아이 범위 토글 */}
      <Skeleton className="h-9 w-40 rounded-full" />
      {/* 오늘 기록/캘린더 영역 */}
      <Skeleton className="h-40 w-full rounded-2xl" />
      <CardSkeletonList count={4} />
    </div>
  )
}

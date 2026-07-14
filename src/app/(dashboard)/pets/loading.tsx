import { Skeleton } from '@/components/ui/Skeleton'

/**
 * '내 아이' 목록 로딩 스켈레톤.
 * 서버 컴포넌트가 pets 쿼리를 기다리는 동안 이전 화면이 멈춘 것처럼 보이지 않게
 * 아바타 + 이름/정보 형태의 카드 골격을 즉시 보여준다.
 */
export default function PetsLoading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

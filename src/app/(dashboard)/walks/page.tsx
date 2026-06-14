'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { cn, formatDistance, formatDuration, formatPace, timeAgo } from '@/lib/utils'
import type { Walk } from '@/types'

type Tab = 'mine' | 'shared'

type WalkRow = Walk & {
  pet?: { name: string } | null
  author?: { display_name: string } | null
  comments?: { count: number }[] | null
}

export default function WalksPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('mine')

  const { data: mine = [], isLoading: mineLoading } = useQuery({
    queryKey: ['walks', 'mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as WalkRow[]
      const { data } = await supabase
        .from('walks')
        .select('*, pet:pets(name)')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
      return (data ?? []) as WalkRow[]
    },
  })

  const { data: shared = [], isLoading: sharedLoading } = useQuery({
    queryKey: ['walks', 'shared'],
    queryFn: async () => {
      const { data } = await supabase
        .from('walks')
        .select('*, author:profiles(display_name), comments:walk_comments(count)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as WalkRow[]
    },
    enabled: tab === 'shared',
  })

  const list = tab === 'mine' ? mine : shared
  const loading = tab === 'mine' ? mineLoading : sharedLoading

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title="산책" fallbackHref="/dashboard" />

      <Link href="/walks/track" className="btn-primary w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2">
        🐾 산책 시작하기
      </Link>

      {/* 탭 */}
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {([['mine', '내 산책'], ['shared', '공유 경로']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <CardSkeletonList count={3} />
      ) : list.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🦮</div>
          {tab === 'mine'
            ? '아직 산책 기록이 없어요. 위에서 산책을 시작해보세요.'
            : '아직 공유된 경로가 없어요. 좋은 산책로를 가장 먼저 공유해보세요!'}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(w => (
            <Link key={w.id} href={`/walks/${w.id}`}>
              <div className="card hover:shadow-md transition-shadow space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl shrink-0" aria-hidden>🦮</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {w.title || '산책'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tab === 'mine'
                        ? <>{w.pet?.name ? `${w.pet.name} · ` : ''}{timeAgo(w.started_at)}</>
                        : <>{w.author?.display_name ?? '익명'} · {timeAgo(w.started_at)}</>}
                    </p>
                  </div>
                  {tab === 'mine' && w.is_public && (
                    <span className="text-[10px] font-medium text-primary-600 bg-primary-50 rounded-full px-2 py-0.5 shrink-0">공유중</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 border-t border-gray-50 pt-2">
                  <span><b className="text-sm text-gray-900">{formatDistance(w.distance_m)}</b> 거리</span>
                  <span><b className="text-sm text-gray-900">{formatDuration(w.duration_s)}</b> 시간</span>
                  <span><b className="text-sm text-gray-900">{formatPace(w.distance_m, w.duration_s)}</b></span>
                  {tab === 'shared' && (
                    <span className="ml-auto flex items-center gap-2 text-gray-500">
                      <span>❤️ {w.like_count ?? 0}</span>
                      <span>💬 {w.comments?.[0]?.count ?? 0}</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

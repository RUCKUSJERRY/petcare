'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { cn, formatDistance, formatDuration, formatPace, timeAgo } from '@/lib/utils'
import type { Walk } from '@/types'

type Tab = 'mine' | 'shared'

type WalkRow = Walk & {
  pet?: { name: string } | null
  author?: { display_name: string } | null
  comment_count?: number
}

function WalksContent() {
  const supabase = createClient()
  const t = useTranslations('walks')
  const router = useRouter()
  const searchParams = useSearchParams()
  // 탭 상태를 URL 쿼리에 보관 → 상세에서 뒤로가기 시 선택했던 탭이 복원된다.
  const tab: Tab = searchParams.get('tab') === 'shared' ? 'shared' : 'mine'
  const setTab = (v: Tab) =>
    router.replace(v === 'shared' ? '/walks?tab=shared' : '/walks', { scroll: false })

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
      // profiles 임베드는 이 프로젝트에서 불안정 → 본문만 받고 작성자/댓글수는 수동 조회
      const { data } = await supabase
        .from('walks')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)
      const rows = (data ?? []) as WalkRow[]
      if (rows.length === 0) return rows

      // 작성자 이름
      const userIds = Array.from(new Set(rows.map(r => r.user_id)))
      const { data: profs } = await supabase
        .from('profiles').select('id, display_name').in('id', userIds)
      const nameMap = new Map((profs ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]))

      // 댓글 수 (walk_comments 마이그레이션 미적용 시에도 안전하게 0으로)
      const countMap = new Map<string, number>()
      const { data: cmts } = await supabase
        .from('walk_comments').select('walk_id').in('walk_id', rows.map(r => r.id))
      for (const c of (cmts ?? []) as { walk_id: string }[]) {
        countMap.set(c.walk_id, (countMap.get(c.walk_id) ?? 0) + 1)
      }

      return rows.map(r => ({
        ...r,
        author: nameMap.has(r.user_id) ? { display_name: nameMap.get(r.user_id)! } : null,
        comment_count: countMap.get(r.id) ?? 0,
      }))
    },
    enabled: tab === 'shared',
  })

  const list = tab === 'mine' ? mine : shared
  const loading = tab === 'mine' ? mineLoading : sharedLoading

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('title')} fallbackHref="/dashboard" />

      <Link href="/walks/track" className="btn-primary w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2">
        🐾 {t('startWalk')}
      </Link>

      {/* 탭 */}
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {([['mine', t('tabMine')], ['shared', t('tabShared')]] as const).map(([v, label]) => (
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
            ? t('emptyMine')
            : t('emptyShared')}
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
                      {w.title || t('walkFallback')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tab === 'mine'
                        ? <>{w.pet?.name ? `${w.pet.name} · ` : ''}{timeAgo(w.started_at)}</>
                        : <>{w.author?.display_name ?? t('anonymous')} · {timeAgo(w.started_at)}</>}
                    </p>
                  </div>
                  {tab === 'mine' && w.is_public && (
                    <span className="text-[10px] font-medium text-primary-600 bg-primary-50 rounded-full px-2 py-0.5 shrink-0">{t('sharing')}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 border-t border-gray-50 pt-2">
                  <span><b className="text-sm text-gray-900">{formatDistance(w.distance_m)}</b> {t('distance')}</span>
                  <span><b className="text-sm text-gray-900">{formatDuration(w.duration_s)}</b> {t('time')}</span>
                  <span><b className="text-sm text-gray-900">{formatPace(w.distance_m, w.duration_s)}</b></span>
                  {tab === 'shared' && (
                    <span className="ml-auto flex items-center gap-2 text-gray-500">
                      <span>❤️ {w.like_count ?? 0}</span>
                      <span>💬 {w.comment_count ?? 0}</span>
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

export default function WalksPage() {
  return (
    <Suspense fallback={null}>
      <WalksContent />
    </Suspense>
  )
}

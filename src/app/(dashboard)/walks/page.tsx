'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDistance, formatDuration, formatPace, timeAgo } from '@/lib/utils'
import { summarizeWalks } from '@/lib/walkStats'
import { WalkGoalCard } from './_components/WalkGoalCard'
import type { Walk } from '@/types'

type Tab = 'mine' | 'shared'

type WalkRow = Walk & {
  pet?: { name: string } | null
  author?: { display_name: string } | null
  comment_count?: number
}

/** 내 산책 통계 — 이번 주/달 합계 + 최근 6주 거리 추이 */
function WalkStatsCard({ walks }: { walks: WalkRow[] }) {
  const t = useTranslations('walks')
  const s = summarizeWalks(walks)

  return (
    <div className="card space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {([['statsThisWeek', s.thisWeek], ['statsThisMonth', s.thisMonth]] as const).map(([key, v]) => (
          <div key={key} className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 font-medium">{t(key)}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatDistance(v.distance_m)}</p>
            <p className="text-xs text-gray-500">
              {formatDuration(v.duration_s)} · {t('statsCount', { n: v.count })}
            </p>
          </div>
        ))}
      </div>

      {/* 최근 6주 거리 추이 */}
      <div>
        <p className="text-xs text-gray-400 font-medium mb-1.5">{t('statsTrend')}</p>
        {s.maxWeekDistance === 0 ? (
          <p className="text-xs text-gray-400">{t('statsEmptyTrend')}</p>
        ) : (
          <div className="flex items-end justify-between gap-1.5 h-20">
            {s.weekly.map(b => {
              const pct = s.maxWeekDistance ? Math.round((b.distance_m / s.maxWeekDistance) * 100) : 0
              const label = `${Number(b.weekStart.slice(5, 7))}/${Number(b.weekStart.slice(8, 10))}`
              return (
                <div key={b.weekStart} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full bg-primary-100 rounded-md relative" style={{ height: `${Math.max(pct, b.distance_m > 0 ? 8 : 2)}%` }}>
                    <div className="absolute inset-0 bg-primary-400 rounded-md" />
                  </div>
                  <span className="text-[11px] text-gray-400">{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
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

  const { data: mine = [], isLoading: mineLoading, isError: mineError } = useQuery({
    queryKey: ['walks', 'mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as WalkRow[]
      const { data, error } = await supabase
        .from('walks')
        .select('*, pet:pets(name)')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
      // 에러를 던져 isError 로 표면화 — 네트워크/RLS 실패가 '기록 없음'으로 오인되지 않도록.
      if (error) throw error
      return (data ?? []) as WalkRow[]
    },
  })

  const { data: shared = [], isLoading: sharedLoading, isError: sharedError } = useQuery({
    queryKey: ['walks', 'shared'],
    queryFn: async () => {
      // profiles 임베드는 이 프로젝트에서 불안정 → 본문만 받고 작성자/댓글수는 수동 조회
      const { data, error } = await supabase
        .from('walks')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
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
  const isError = tab === 'mine' ? mineError : sharedError

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('title')} fallbackHref="/dashboard" />

      <SectionTabs section="map" />

      {/* 이 화면은 내 GPS 산책 기록·통계. 권장 산책량·활동 팁은 '활동 가이드'로 안내(명칭 혼선 방지). */}
      <Link
        href="/walk"
        className="flex items-center justify-between gap-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl px-3.5 py-2.5 hover:bg-primary-100 transition-colors"
      >
        <span className="flex items-center gap-1.5"><span aria-hidden>🎾</span>{t('guideLink')}</span>
        <span aria-hidden>›</span>
      </Link>

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

      {/* 내 산책 통계 + 주간 목표 (내 산책 탭 + 기록 있을 때) */}
      {tab === 'mine' && !mineLoading && mine.length > 0 && (
        <>
          <WalkGoalCard walks={mine} />
          <WalkStatsCard walks={mine} />
        </>
      )}

      {loading ? (
        <CardSkeletonList count={3} />
      ) : isError ? (
        <EmptyState variant="error" title={t('loadError')} />
      ) : list.length === 0 ? (
        <EmptyState icon="🦮" title={tab === 'mine' ? t('emptyMine') : t('emptyShared')} />
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

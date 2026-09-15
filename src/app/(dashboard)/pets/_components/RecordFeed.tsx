'use client'

import { createClient } from '@/lib/supabase/client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, todayKST, addDays } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'

type Row = {
  id: string
  pet_id: string
  category: string
  title: string
  event_on: string
  event_at: string | null
  memo: string | null
  pet: { name: string; species: string } | null
}

// SNS 피드처럼 한 번에 넉넉히 보여주고, 바닥 근처에서 다음 묶음을 이어 로딩한다.
const PAGE = 20

const hhmm = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 반려동물 기록을 SNS 피드(인스타·페북)처럼 시간 흐름으로 무한 스크롤하며 보여준다.
 * 날짜가 바뀌면 날짜 헤더를 끼워넣고, 한 줄을 누르면 상세 모달을 연다.
 * scroll=true 면 내부 고정 높이 영역에서 스크롤(홈 카드 인라인용),
 * 아니면 페이지 스크롤을 따라간다.
 */
export function RecordFeed({
  petId,
  tone = 'plain',
  showPetName = false,
  scroll = false,
  onSelect,
}: {
  petId: string | null
  tone?: 'plain' | 'onPrimary'
  showPetName?: boolean
  scroll?: boolean
  onSelect: (id: string) => void
}) {
  const t = useTranslations('quickLog')
  const supabase = createClient()
  const onP = tone === 'onPrimary'
  const rootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery({
    queryKey: ['record-feed', petId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE
      let q = supabase
        .from('records')
        .select('id, pet_id, category, title, event_on, event_at, memo, pet:pets(name, species)')
        .order('event_on', { ascending: false })
        .order('event_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (petId) q = q.eq('pet_id', petId)
      const { data } = await q
      return (data ?? []) as unknown as Row[]
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE ? allPages.length : undefined),
  })

  const rows = data?.pages.flat() ?? []

  // 바닥 근처에 닿으면 다음 페이지 로드 (무한 스크롤)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { root: scroll ? rootRef.current : null, rootMargin: '120px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [scroll, hasNextPage, isFetchingNextPage, fetchNextPage])

  const today = todayKST()
  const yest = addDays(today, -1)
  const dateLabel = (d: string) => {
    if (d === today) return t('labelToday')
    if (d === yest) return t('labelYesterday')
    const [, m, dd] = d.split('-').map(Number)
    return t('labelDate', { month: m, day: dd })
  }

  // 첫 로딩 중에는 빈 상태를 감추고 조용히 비워둔다 — 캐시 미스마다 "기록 없음"이 번쩍이지 않도록.
  if (isPending) {
    if (onP) return <div className="h-6" aria-hidden />
    return <div className="card h-24 animate-pulse bg-gray-50" aria-hidden />
  }

  if (rows.length === 0) {
    if (onP) return <p className="text-xs text-white/85 py-1">{t('emptyTodayHint')}</p>
    return <EmptyState icon="🐾" title={t('feedEmpty')} hint={t('emptyTodayHint')} />
  }

  const rowCls = onP
    ? 'flex items-center gap-2.5 rounded-lg bg-white/12 hover:bg-white/20 px-2.5 py-1.5 transition-colors'
    : 'card flex items-center gap-3 hover:shadow-md transition-shadow'

  let lastDate = ''
  // 홈 인라인 피드는 화면 대부분을 차지하는 넉넉한 높이의 '피드 창'으로 둔다 — 예전 짧은
  // 박스(max-h-72≈288px)는 손가락이 늘 박스 위에 놓여 페이지 대신 작은 박스만 스크롤되는
  // 갇힘(scroll trap)이 잦았다. 창을 크게 해 이 안을 스크롤하는 것이 곧 SNS 피드 탐색이 되게 하고,
  // 끝에 닿으면 자연히 페이지 스크롤로 이어진다.
  const containerCls = scroll
    ? `max-h-[65vh] overflow-y-auto scrollbar-none ${onP ? 'pr-0.5' : ''}`
    : ''

  return (
    <div ref={rootRef} className={containerCls}>
      <div className={onP ? 'space-y-1.5' : 'space-y-2'}>
        {rows.map(r => {
          const showHeader = r.event_on !== lastDate
          lastDate = r.event_on
          return (
            <div key={r.id}>
              {showHeader && (
                <p className={`text-xs font-semibold ${onP ? 'text-white/70' : 'text-gray-500'} ${r.event_on === rows[0].event_on ? 'mt-0' : 'mt-2.5'} mb-1`}>
                  {dateLabel(r.event_on)}
                </p>
              )}
              <button onClick={() => onSelect(r.id)} className="w-full text-left">
                <div className={rowCls}>
                  <span className={`text-xs font-semibold tabular-nums shrink-0 text-center ${onP ? 'text-white/80 w-9' : 'text-gray-500 w-10'}`}>
                    {hhmm(r.event_at) || '·'}
                  </span>
                  <span className={`shrink-0 ${onP ? 'text-base' : 'text-xl'}`} aria-hidden>{careCategoryIcon(r.category)}</span>
                  <div className="flex-1 min-w-0">
                    {onP ? (
                      <p className="text-sm font-medium text-white truncate">
                        {showPetName && r.pet ? `${r.pet.name} · ` : ''}{r.title}
                        {r.memo ? <span className="text-white/60"> · {r.memo}</span> : ''}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          {showPetName && r.pet && (
                            <>
                              <span className="text-xs text-gray-500">{r.pet.species === 'cat' ? '🐱' : '🐶'} {r.pet.name}</span>
                              <span className="text-xs text-gray-300">·</span>
                            </>
                          )}
                          <span className="text-xs text-gray-500">{r.category}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                        {r.memo && <p className="text-xs text-gray-500 truncate">{r.memo}</p>}
                      </>
                    )}
                  </div>
                  <span aria-hidden className={onP ? 'text-white/40 shrink-0' : 'text-gray-300 shrink-0'}>›</span>
                </div>
              </button>
            </div>
          )
        })}
        {/* 무한 스크롤 센티넬 */}
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <p className={`text-xs text-center py-1 ${onP ? 'text-white/70' : 'text-gray-500'}`}>{t('loadingMore')}</p>
        )}
      </div>
    </div>
  )
}

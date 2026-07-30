'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { categoryColor, timeAgo } from '@/lib/utils'
import type { PostCategory, PostListItem } from '@/types'

type SortKey = 'latest' | 'popular'

/**
 * 커뮤니티 글 목록 — 첫 페이지는 서버에서 렌더된 initialPosts 로 시작하고,
 * 이후 페이지는 브라우저에서 이어붙인다(무한 스크롤). 기존의 이전/다음 페이지네이션은
 * 매번 전체 내비게이션 + 스크롤 리셋이라 모바일 피드 탐색에 불편했다.
 *
 * 서버(community/page.tsx)와 '완전히 같은' 조건(정렬·카테고리·내 글·검색)으로 조회해야
 * 이어지는 페이지가 첫 페이지와 일관된다 — 그 파라미터를 그대로 props 로 받는다.
 */
export function PostList({
  initialPosts,
  category,
  mine,
  sort,
  safeQ,
  userId,
  pageSize,
}: {
  initialPosts: PostListItem[]
  category: PostCategory | null
  mine: boolean
  sort: SortKey
  safeQ: string
  userId: string | null
  pageSize: number
}) {
  const t = useTranslations('community')
  const tc = useTranslations('common')
  const supabase = createClient()

  const [posts, setPosts] = useState<PostListItem[]>(initialPosts)
  const [hasMore, setHasMore] = useState(initialPosts.length === pageSize)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // 필터/정렬/검색이 바뀌면 서버가 새 initialPosts 로 리렌더한다 — 목록 상태를 초기화한다.
  useEffect(() => {
    setPosts(initialPosts)
    setHasMore(initialPosts.length === pageSize)
    setError(false)
  }, [initialPosts, pageSize])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError(false)
    // offset 은 현재까지 쌓인 개수 — 페이지 산술 누적 오차를 피한다.
    const from = posts.length
    let query = supabase.from('post_list').select('*')
    if (sort === 'popular') {
      query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    if (category) query = query.eq('category', category)
    if (mine && userId) query = query.eq('user_id', userId)
    if (safeQ) query = query.or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)
    query = query.range(from, from + pageSize - 1)

    const { data, error: err } = await query
    if (err) {
      setError(true)
      setLoading(false)
      return
    }
    const next = (data ?? []) as PostListItem[]
    setPosts(prev => {
      // 혹시 모를 중복(경계에서 새 글이 끼어드는 경우)을 id 로 걸러 append.
      const seen = new Set(prev.map(p => p.id))
      return [...prev, ...next.filter(p => !seen.has(p.id))]
    })
    setHasMore(next.length === pageSize)
    setLoading(false)
  }, [loading, hasMore, posts.length, supabase, sort, category, mine, userId, safeQ, pageSize])

  // 무한 스크롤: 목록 끝 센티넬이 보이면 다음 페이지를 불러온다. (버튼은 IO 미지원·오류 시 폴백)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || error) return
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, error, loadMore])

  return (
    <div className="px-4 space-y-3 mt-1">
      {posts.map(post => (
        <Link key={post.id} href={`/community/${post.id}`} className="block">
          <article className="card space-y-2 active:scale-[0.99] transition-transform">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(post.category)}`}>
                {post.category}
              </span>
              {post.breed_name && (
                <span className="text-xs text-gray-400">· {post.breed_name}</span>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 line-clamp-1">{post.title}</h2>
                <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{post.content}</p>
              </div>
              {post.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image_url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
              <span>{post.author_name ?? t('anonymous')}</span>
              <span>{timeAgo(post.created_at)}</span>
              <span className="ml-auto flex items-center gap-3">
                <span>❤️ {post.like_count}</span>
                <span>💬 {post.comment_count}</span>
              </span>
            </div>
          </article>
        </Link>
      ))}

      {/* 더 보기 영역 — 센티넬(자동 로드) + 수동 버튼/상태 */}
      {hasMore && (
        <div ref={sentinelRef} className="pt-2 pb-1 flex flex-col items-center gap-2">
          {error ? (
            <>
              <p className="text-xs text-red-500">{t('loadError')}</p>
              <button onClick={loadMore} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                {tc('retry')}
              </button>
            </>
          ) : (
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium disabled:opacity-50"
            >
              {loading ? tc('loading') : t('loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

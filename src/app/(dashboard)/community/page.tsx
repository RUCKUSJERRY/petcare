import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { categoryColor, timeAgo } from '@/lib/utils'
import type { PostCategory, PostListItem } from '@/types'
import { SearchBar } from './_components/SearchBar'

const CATEGORIES: PostCategory[] = ['질문', '자랑', '정보공유', '일상']
const PAGE_SIZE = 20
type SortKey = 'latest' | 'popular'

function buildUrl(params: {
  category?: string | null
  mine?: boolean
  sort?: SortKey
  q?: string | null
  page?: number
}) {
  const p = new URLSearchParams()
  if (params.category) p.set('category', params.category)
  if (params.mine) p.set('mine', 'true')
  if (params.sort && params.sort !== 'latest') p.set('sort', params.sort)
  if (params.q) p.set('q', params.q)
  if (params.page && params.page > 1) p.set('page', String(params.page))
  const qs = p.toString()
  return qs ? `/community?${qs}` : '/community'
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string; mine?: string; sort?: string; q?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE
  const mine = searchParams.mine === 'true'
  const sort: SortKey = searchParams.sort === 'popular' ? 'popular' : 'latest'
  const q = (searchParams.q ?? '').trim()
  const activeCategory = CATEGORIES.includes(searchParams.category as PostCategory)
    ? (searchParams.category as PostCategory)
    : null

  let query = supabase.from('post_list').select('*')

  if (sort === 'popular') {
    query = query
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (activeCategory) query = query.eq('category', activeCategory)
  if (mine && user) query = query.eq('user_id', user.id)
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)

  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data } = await query
  const posts = (data ?? []) as PostListItem[]
  const hasNext = posts.length === PAGE_SIZE

  // 검색바가 현재 필터를 유지하도록 base 파라미터 구성
  const baseParams: Record<string, string> = {}
  if (activeCategory) baseParams.category = activeCategory
  if (mine) baseParams.mine = 'true'
  if (sort !== 'latest') baseParams.sort = sort

  return (
    <div className="pb-6">
      {/* 헤더 */}
      <div className="sticky top-0 bg-gray-50/90 backdrop-blur z-10 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">커뮤니티</h1>
          <Link href="/community/new" className="btn-primary text-sm py-1.5 px-3">
            글쓰기
          </Link>
        </div>

        {/* 검색바 */}
        <div className="mb-3">
          <SearchBar initialQuery={q} baseParams={baseParams} />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <FilterChip label="전체" href={buildUrl({ mine, sort, q })} active={!activeCategory && !mine} />
          {CATEGORIES.map(c => (
            <FilterChip
              key={c}
              label={c}
              href={buildUrl({ category: c, mine, sort, q })}
              active={activeCategory === c}
            />
          ))}
          {user && (
            <FilterChip
              label="내 글"
              href={buildUrl({ category: activeCategory, mine: !mine, sort, q })}
              active={mine}
            />
          )}
        </div>

        {/* 정렬 토글 */}
        <div className="flex gap-3 mt-2 text-sm">
          <SortLink label="최신순" href={buildUrl({ category: activeCategory, mine, q, sort: 'latest' })} active={sort === 'latest'} />
          <SortLink label="인기순" href={buildUrl({ category: activeCategory, mine, q, sort: 'popular' })} active={sort === 'popular'} />
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 space-y-3 mt-1">
        {posts.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            {q
              ? `'${q}' 검색 결과가 없어요.`
              : mine
              ? '아직 작성한 글이 없어요.'
              : '아직 글이 없어요. 첫 글을 남겨보세요! 🐾'}
          </div>
        ) : (
          posts.map(post => (
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
                  <span>{post.author_name ?? '익명의 보호자'}</span>
                  <span>{timeAgo(post.created_at)}</span>
                  <span className="ml-auto flex items-center gap-3">
                    <span>❤️ {post.like_count}</span>
                    <span>💬 {post.comment_count}</span>
                  </span>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-center gap-3 px-4 pt-4">
          {page > 1 && (
            <Link
              href={buildUrl({ category: activeCategory, mine, sort, q, page: page - 1 })}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium"
            >
              ← 이전
            </Link>
          )}
          <span className="text-sm text-gray-400">{page}페이지</span>
          {hasNext && (
            <Link
              href={buildUrl({ category: activeCategory, mine, sort, q, page: page + 1 })}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium"
            >
              다음 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function SortLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`font-medium transition-colors ${active ? 'text-primary-600' : 'text-gray-400'}`}
    >
      {label}
    </Link>
  )
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
      }`}
    >
      {label}
    </Link>
  )
}

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PostCategory, PostListItem } from '@/types'
import { SearchBar } from './_components/SearchBar'
import { PostList } from './_components/PostList'
import { FilterScroller } from '@/components/ui/FilterScroller'
import { EmptyState } from '@/components/ui/EmptyState'

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
  const t = await getTranslations('community')
  const { data: { user } } = await supabase.auth.getUser()

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
  // PostgREST .or() 필터에서 구조 문자(쉼표/괄호/역슬래시)와 LIKE 와일드카드(%,_)는
  // 검색을 깨뜨리거나 의도치 않은 조건 주입을 일으킬 수 있어 제거/무력화한다.
  const safeQ = q ? q.replace(/[,()\\]/g, ' ').replace(/[%_]/g, '').trim() : ''
  // 검색어를 입력했지만 특수문자만 남아 실제로 검색할 내용이 없으면, 전체 목록을 검색 결과처럼
  // 내보내지 않고 '결과 없음'으로 처리한다. (예: "%%%" 검색 시 전체 글이 노출되던 문제)
  const searchButEmpty = !!q && !safeQ
  if (safeQ) query = query.or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`)

  // 첫 페이지만 서버에서 렌더하고, 이후는 클라이언트(PostList)가 무한 스크롤로 이어붙인다.
  query = query.range(0, PAGE_SIZE - 1)

  const { data } = searchButEmpty ? { data: [] as PostListItem[] } : await query
  const posts = (data ?? []) as PostListItem[]

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
          <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
          <Link href="/community/new" className="btn-primary text-sm py-1.5 px-3">
            {t('write')}
          </Link>
        </div>

        {/* 검색바 */}
        <div className="mb-3">
          <SearchBar initialQuery={q} baseParams={baseParams} />
        </div>

        {/* 카테고리 필터 */}
        <FilterScroller className="pb-1">
          {/* 칩은 상호배타(라디오)로 동작: 전체/카테고리/내 글 중 하나만 선택 */}
          <FilterChip label={t('filterAll')} href={buildUrl({ sort, q })} active={!activeCategory && !mine} />
          {CATEGORIES.map(c => (
            <FilterChip
              key={c}
              label={c}
              href={buildUrl({ category: c, sort, q })}
              active={activeCategory === c && !mine}
            />
          ))}
          {user && (
            <FilterChip
              label={t('filterMine')}
              href={buildUrl({ mine: true, sort, q })}
              active={mine}
            />
          )}
        </FilterScroller>

        {/* 정렬 토글 */}
        <div className="flex gap-3 mt-2 text-sm">
          <SortLink label={t('sortLatest')} href={buildUrl({ category: activeCategory, mine, q, sort: 'latest' })} active={sort === 'latest'} />
          <SortLink label={t('sortPopular')} href={buildUrl({ category: activeCategory, mine, q, sort: 'popular' })} active={sort === 'popular'} />
        </div>
      </div>

      {/* 목록 — 첫 페이지는 서버 렌더, 이후는 PostList 가 무한 스크롤로 이어붙인다 */}
      {posts.length === 0 ? (
        <div className="px-4 mt-1">
          <EmptyState
            icon="💬"
            title={q ? t('emptySearch', { q }) : mine ? t('emptyMine') : t('empty')}
            // 검색·카테고리·'내 글' 필터 조합으로 막다른 결과가 나오면, 어떤 필터가 걸렸는지
            // 헤매지 않도록 한 번에 전체 목록으로 돌아가는 링크를 준다(음식 화면과 동일 패턴).
            action={
              (q || activeCategory || mine) ? (
                <Link href="/community" className="btn-primary text-sm py-1.5 px-4">
                  {t('resetFilters')}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <PostList
          // 필터/정렬/검색이 바뀌면 서버가 새 목록으로 리렌더 — key 로 클라이언트 상태를 확실히 초기화
          key={`${activeCategory ?? 'all'}|${mine}|${sort}|${safeQ}`}
          initialPosts={posts}
          category={activeCategory}
          mine={mine}
          sort={sort}
          safeQ={safeQ}
          userId={user?.id ?? null}
          pageSize={PAGE_SIZE}
        />
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

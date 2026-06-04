import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { categoryColor, timeAgo } from '@/lib/utils'
import type { PostCategory, PostListItem } from '@/types'

const CATEGORIES: PostCategory[] = ['질문', '자랑', '정보공유', '일상']

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const activeCategory = CATEGORIES.includes(searchParams.category as PostCategory)
    ? (searchParams.category as PostCategory)
    : null

  let query = supabase
    .from('post_list')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (activeCategory) query = query.eq('category', activeCategory)

  const { data } = await query
  const posts = (data ?? []) as PostListItem[]

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

        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <FilterChip label="전체" href="/community" active={!activeCategory} />
          {CATEGORIES.map(c => (
            <FilterChip
              key={c}
              label={c}
              href={`/community?category=${encodeURIComponent(c)}`}
              active={activeCategory === c}
            />
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 space-y-3 mt-1">
        {posts.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            아직 글이 없어요. 첫 글을 남겨보세요! 🐾
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

                <h2 className="font-semibold text-gray-900 line-clamp-1">{post.title}</h2>
                <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>

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
    </div>
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

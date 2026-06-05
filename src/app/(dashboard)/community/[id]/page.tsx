import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { categoryColor, timeAgo } from '@/lib/utils'
import type { Comment, PostListItem } from '@/types'
import { LikeButton } from '../_components/LikeButton'
import { CommentSection } from '../_components/CommentSection'
import { DeletePostButton } from '../_components/DeletePostButton'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 글 (작성자/견종/카운트 포함)
  const { data: postData } = await supabase
    .from('post_list')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!postData) notFound()
  const post = postData as PostListItem

  // 댓글 + 작성자
  const { data: commentData } = await supabase
    .from('comments')
    .select('*, author:profiles(display_name, avatar_url)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })
  const comments = (commentData ?? []) as unknown as Comment[]

  // 내가 좋아요 눌렀는지
  let likedByMe = false
  if (user) {
    const { data: like } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    likedByMe = !!like
  }

  const isAuthor = user?.id === post.user_id

  return (
    <div className="px-4 py-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <Link href="/community" className="text-gray-400" aria-label="목록">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {isAuthor && <DeletePostButton postId={post.id} />}
      </div>

      {/* 본문 */}
      <article className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(post.category)}`}>
            {post.category}
          </span>
          {post.breed_name && (
            <span className="text-xs text-gray-400">· {post.breed_name}</span>
          )}
        </div>

        <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{post.author_name ?? '익명의 보호자'}</span>
          <span>·</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        <p className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed pt-2">
          {post.content}
        </p>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="w-full rounded-xl object-cover mt-2"
          />
        )}
      </article>

      {/* 좋아요 */}
      <div className="flex justify-center py-2">
        <LikeButton postId={post.id} initialCount={post.like_count} initialLiked={likedByMe} />
      </div>

      <hr className="border-gray-100" />

      {/* 댓글 */}
      <CommentSection
        postId={post.id}
        initialComments={comments}
        currentUserId={user?.id ?? null}
      />
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { categoryColor, timeAgo } from '@/lib/utils'
import type { Comment, PostListItem } from '@/types'
import { LikeButton } from '../_components/LikeButton'
import { CommentSection } from '../_components/CommentSection'
import { DeletePostButton } from '../_components/DeletePostButton'
import { BackButton } from '@/components/ui/BackButton'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { ShareButton } from '@/components/ui/ShareButton'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: postData } = await supabase
    .from('post_list')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!postData) notFound()
  const post = postData as PostListItem

  // 댓글 조회 (comments→profiles 직접 FK가 없어 임베드 대신 앱에서 작성자 조인)
  const { data: commentData } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })
  const rawComments = (commentData ?? []) as Comment[]

  const authorIds = Array.from(new Set(rawComments.map(c => c.user_id)))
  const authorMap = new Map<string, { display_name: string; avatar_url: string | null }>()
  if (authorIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', authorIds)
    for (const p of (profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]) {
      authorMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
    }
  }
  const comments = rawComments.map(c => ({
    ...c,
    author: authorMap.get(c.user_id) ?? { display_name: '익명의 보호자', avatar_url: null },
  })) as Comment[]

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
        <BackButton />
        <div className="flex items-center gap-3">
          <ShareButton
            path={`/community/${post.id}`}
            title={post.title}
            text="펫케어 커뮤니티 글을 확인해보세요"
            label="공유"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
          />
          {isAuthor && (
            <>
              <Link
                href={`/community/${post.id}/edit`}
                className="text-sm text-primary-600 font-semibold"
              >
                수정
              </Link>
              <DeletePostButton postId={post.id} imageUrl={post.image_url} />
            </>
          )}
        </div>
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
          {post.updated_at !== post.created_at && (
            <span className="text-xs text-gray-300">(수정됨)</span>
          )}
        </div>

        <p className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed pt-2">
          {post.content}
        </p>

        {post.image_url && (
          <ImageLightbox
            src={post.image_url}
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

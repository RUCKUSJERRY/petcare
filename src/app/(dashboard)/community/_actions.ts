'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { revalidatePath } from 'next/cache'

async function actorName(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return (data as { display_name?: string } | null)?.display_name ?? '익명의 보호자'
}

/**
 * 좋아요 토글. DB 반영 후 커뮤니티 목록·상세의 Router Cache를 무효화해
 * 어떤 필터로 돌아가도 최신 like_count가 보이도록 한다.
 */
export async function toggleLike(postId: string, like: boolean): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const { error } = like
    ? await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)

  if (error) return { error: error.message }

  // 좋아요(신규)일 때 글 작성자에게 푸시 (본인 제외)
  if (like) {
    const { data: post } = await supabase.from('posts').select('user_id, title').eq('id', postId).maybeSingle()
    const p = post as { user_id: string; title: string } | null
    if (p && p.user_id !== user.id) {
      await sendPushToUser(p.user_id, {
        title: '펫케어',
        body: `${await actorName(supabase, user.id)}님이 회원님의 글을 좋아해요`,
        url: `/community/${postId}`,
        tag: `like-${postId}`,
      })
    }
  }

  revalidatePath('/community')
  revalidatePath(`/community/${postId}`)
  return { error: null }
}

/**
 * 새 댓글/답글에 대한 푸시 발송. 클라이언트가 댓글 저장 성공 후 호출.
 * 답글이면 부모 댓글 작성자, 최상위면 글 작성자에게 (본인 제외).
 */
export async function notifyNewComment(commentId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: c } = await supabase
    .from('comments')
    .select('post_id, parent_id, content')
    .eq('id', commentId)
    .maybeSingle()
  const comment = c as { post_id: string; parent_id: string | null; content: string } | null
  if (!comment) return

  let recipientId: string | null = null
  let isReply = false
  if (comment.parent_id) {
    const { data: parent } = await supabase.from('comments').select('user_id').eq('id', comment.parent_id).maybeSingle()
    recipientId = (parent as { user_id?: string } | null)?.user_id ?? null
    isReply = true
  } else {
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', comment.post_id).maybeSingle()
    recipientId = (post as { user_id?: string } | null)?.user_id ?? null
  }
  if (!recipientId || recipientId === user.id) return

  const name = await actorName(supabase, user.id)
  await sendPushToUser(recipientId, {
    title: '펫케어',
    body: `${name}님이 ${isReply ? '답글' : '댓글'}을 남겼어요: ${comment.content.slice(0, 40)}`,
    url: `/community/${comment.post_id}`,
    tag: `comment-${comment.post_id}`,
  })
}

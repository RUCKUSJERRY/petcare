'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/community')
  revalidatePath(`/community/${postId}`)
  return { error: null }
}

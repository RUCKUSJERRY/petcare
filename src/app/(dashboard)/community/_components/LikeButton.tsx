'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string
  initialCount: number
  initialLiked: boolean
}) {
  const supabase = createClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    if (pending) return
    setPending(true)

    // 낙관적 업데이트
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // 롤백
      setLiked(!next)
      setCount(c => c + (next ? -1 : 1))
      setPending(false)
      return
    }

    const { error } = next
      ? await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
      : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)

    if (error) {
      // 실패 시 롤백
      setLiked(!next)
      setCount(c => c + (next ? -1 : 1))
    }
    setPending(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
        liked
          ? 'bg-red-50 border-red-200 text-red-600'
          : 'bg-white border-gray-200 text-gray-600'
      }`}
    >
      <span>{liked ? '❤️' : '🤍'}</span>
      <span>{count}</span>
    </button>
  )
}

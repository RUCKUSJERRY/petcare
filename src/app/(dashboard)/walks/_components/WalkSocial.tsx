'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { timeAgo } from '@/lib/utils'
import type { WalkComment } from '@/types'

/**
 * 공유된 산책에 대한 좋아요 + 댓글 (커뮤니티 게시판처럼).
 * 공개(is_public) 산책에서만 노출한다.
 */
export function WalkSocial({
  walkId,
  initialLikeCount,
}: {
  walkId: string
  initialLikeCount: number
}) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [uid, setUid] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialLikeCount)
  const [pending, setPending] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id ?? null
      setUid(id)
      if (id) {
        const { data: like } = await supabase
          .from('walk_likes').select('walk_id').eq('walk_id', walkId).eq('user_id', id).maybeSingle()
        setLiked(!!like)
      }
    })
  }, [supabase, walkId])

  const { data: comments = [] } = useQuery({
    queryKey: ['walk-comments', walkId],
    queryFn: async () => {
      const { data } = await supabase
        .from('walk_comments').select('*').eq('walk_id', walkId).order('created_at', { ascending: true })
      const rows = (data ?? []) as WalkComment[]
      const ids = Array.from(new Set(rows.map(r => r.user_id)))
      const map = new Map<string, { display_name: string; avatar_url: string | null }>()
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
        for (const p of (profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]) {
          map.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
        }
      }
      return rows.map(r => ({ ...r, author: map.get(r.user_id) ?? { display_name: '익명의 보호자', avatar_url: null } }))
    },
  })

  const toggleLike = async () => {
    if (pending || !uid) return
    setPending(true)
    const next = !liked
    setLiked(next); setCount(c => c + (next ? 1 : -1))
    const { error } = next
      ? await supabase.from('walk_likes').insert({ walk_id: walkId, user_id: uid })
      : await supabase.from('walk_likes').delete().eq('walk_id', walkId).eq('user_id', uid)
    if (error) { setLiked(!next); setCount(c => c + (next ? -1 : 1)) }
    setPending(false)
  }

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending || !uid) return
    setSending(true)
    const { error } = await supabase.from('walk_comments').insert({ walk_id: walkId, user_id: uid, content })
    setSending(false)
    if (!error) {
      setText('')
      qc.invalidateQueries({ queryKey: ['walk-comments', walkId] })
    }
  }

  const removeComment = async (id: string) => {
    await supabase.from('walk_comments').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['walk-comments', walkId] })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          onClick={toggleLike}
          disabled={pending || !uid}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
            liked ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{count}</span>
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">
          댓글 <span className="text-primary-500">{comments.length}</span>
        </h3>
        <form onSubmit={addComment} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={uid ? '댓글을 남겨보세요' : '로그인 후 댓글을 남길 수 있어요'}
            maxLength={1000}
            value={text}
            disabled={!uid}
            onChange={e => setText(e.target.value)}
          />
          <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 shrink-0">등록</button>
        </form>
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">아직 댓글이 없어요</p>
          ) : comments.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : '🐾'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{c.author?.display_name ?? '익명의 보호자'}</span>
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                  {c.user_id === uid && (
                    <button onClick={() => removeComment(c.id)} className="ml-auto text-xs text-gray-300 hover:text-red-500">삭제</button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'
import { useState } from 'react'
import type { Comment } from '@/types'

export function CommentSection({
  postId,
  initialComments,
  currentUserId,
}: {
  postId: string
  initialComments: Comment[]
  currentUserId: string | null
}) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('로그인이 필요해요')
      setSending(false)
      return
    }

    // 1) 댓글 저장 (임베드 없이 단순 insert → 트리거/관계 이슈와 분리)
    const { data, error: insErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content })
      .select('*')
      .single()

    if (insErr || !data) {
      setError('댓글 저장에 실패했어요. 다시 시도해주세요.')
      setSending(false)
      return
    }

    // 2) 작성자 표시 정보는 내 프로필에서 채움
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    const newComment = {
      ...(data as Comment),
      author: profile ?? { display_name: '익명의 보호자', avatar_url: null },
    } as unknown as Comment

    setComments(prev => [...prev, newComment])
    setText('')
    setSending(false)
  }

  const remove = async (id: string) => {
    const prev = comments
    setComments(c => c.filter(x => x.id !== id)) // 낙관적
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) setComments(prev) // 롤백
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        댓글 <span className="text-primary-500">{comments.length}</span>
      </h3>

      {/* 입력 */}
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="댓글을 입력하세요"
          maxLength={1000}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="btn-primary px-4 shrink-0"
        >
          등록
        </button>
      </form>
      {error && <p className="text-sm text-red-500 -mt-2">{error}</p>}

      {/* 목록 */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            첫 댓글을 남겨보세요
          </p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>🐶</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {c.author?.display_name ?? '익명의 보호자'}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                  {currentUserId === c.user_id && (
                    <button
                      onClick={() => remove(c.id)}
                      className="text-xs text-gray-400 ml-auto hover:text-red-500"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                  {c.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

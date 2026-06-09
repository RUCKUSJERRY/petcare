'use client'

import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'
import { useRef, useState } from 'react'
import { notifyNewComment } from '../_actions'
import type { Comment } from '@/types'

type Author = { display_name: string; avatar_url: string | null }

function isEdited(c: Comment) {
  return new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 1000
}

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

  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const myAuthorRef = useRef<Author | null>(null)
  const getMyAuthor = async (userId: string): Promise<Author> => {
    if (myAuthorRef.current) return myAuthorRef.current
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    myAuthorRef.current = (data as Author) ?? { display_name: '익명의 보호자', avatar_url: null }
    return myAuthorRef.current
  }

  // 새 댓글/답글 작성. parentId가 있으면 답글.
  const addComment = async (content: string, parentId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요해요'); return false }

    const { data, error: insErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content, parent_id: parentId })
      .select('*')
      .single()
    if (insErr || !data) { setError('저장에 실패했어요. 다시 시도해주세요.'); return false }

    const author = await getMyAuthor(user.id)
    setComments(prev => [...prev, { ...(data as Comment), author }])
    // 수신자에게 푸시 (베스트 에포트, 실패 무시)
    notifyNewComment((data as Comment).id).catch(() => {})
    return true
  }

  const submitTop = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true); setError(null)
    if (await addComment(content, null)) setText('')
    setSending(false)
  }

  const submitReply = async (parentId: string) => {
    const content = replyText.trim()
    if (!content) return
    setError(null)
    if (await addComment(content, parentId)) {
      setReplyText('')
      setReplyTo(null)
    }
  }

  const saveEdit = async (id: string) => {
    const content = editText.trim()
    if (!content) return
    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('comments')
      .update({ content, updated_at: now })
      .eq('id', id)
    if (updErr) { setError('수정에 실패했어요'); return }
    setComments(prev => prev.map(c => c.id === id ? { ...c, content, updated_at: now } : c))
    setEditingId(null)
  }

  const remove = async (id: string) => {
    const prev = comments
    // 부모를 지우면 답글도 함께 제거(DB는 cascade, UI도 동일하게)
    setComments(c => c.filter(x => x.id !== id && x.parent_id !== id))
    const { error: delErr } = await supabase.from('comments').delete().eq('id', id)
    if (delErr) setComments(prev)
  }

  const topLevel = comments
    .filter(c => !c.parent_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const repliesOf = (id: string) =>
    comments.filter(c => c.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))

  const renderComment = (c: Comment, isReply: boolean) => {
    const mine = currentUserId === c.user_id
    const editing = editingId === c.id
    return (
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {c.author?.display_name ?? '익명의 보호자'}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
            {isEdited(c) && <span className="text-xs text-gray-300">(수정됨)</span>}
          </div>

          {editing ? (
            <div className="mt-1 flex gap-2">
              <input
                className="input flex-1 py-1.5 text-sm"
                value={editText}
                maxLength={1000}
                onChange={e => setEditText(e.target.value)}
                autoFocus
              />
              <button onClick={() => saveEdit(c.id)} className="btn-primary px-3 text-sm shrink-0">저장</button>
              <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 shrink-0">취소</button>
            </div>
          ) : (
            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
          )}

          {/* 액션 */}
          {!editing && (
            <div className="flex items-center gap-3 mt-1">
              {!isReply && (
                <button
                  onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') }}
                  className="text-xs text-gray-400 hover:text-primary-600"
                >
                  답글
                </button>
              )}
              {mine && (
                <>
                  <button
                    onClick={() => { setEditingId(c.id); setEditText(c.content) }}
                    className="text-xs text-gray-400 hover:text-primary-600"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )}

          {/* 답글 입력 */}
          {replyTo === c.id && (
            <div className="mt-2 flex gap-2">
              <input
                className="input flex-1 py-1.5 text-sm"
                placeholder="답글을 입력하세요"
                value={replyText}
                maxLength={1000}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReply(c.id) }}
                autoFocus
              />
              <button
                onClick={() => submitReply(c.id)}
                disabled={!replyText.trim()}
                className="btn-primary px-3 text-sm shrink-0"
              >
                등록
              </button>
            </div>
          )}

          {/* 답글 목록 */}
          {!isReply && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
              {repliesOf(c.id).map(r => renderComment(r, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        댓글 <span className="text-primary-500">{comments.length}</span>
      </h3>

      {/* 입력 */}
      <form onSubmit={submitTop} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="댓글을 입력하세요"
          maxLength={1000}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 shrink-0">
          등록
        </button>
      </form>
      {error && <p className="text-sm text-red-500 -mt-2">{error}</p>}

      {/* 목록 */}
      <div className="space-y-4">
        {topLevel.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">첫 댓글을 남겨보세요</p>
        ) : (
          topLevel.map(c => renderComment(c, false))
        )}
      </div>
    </div>
  )
}

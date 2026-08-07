'use client'

import { createClient } from '@/lib/supabase/client'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('community')
  const tc = useTranslations('common')
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const myAuthorRef = useRef<Author | null>(null)
  const getMyAuthor = async (userId: string): Promise<Author> => {
    if (myAuthorRef.current) return myAuthorRef.current
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    myAuthorRef.current = (data as Author) ?? { display_name: t('anonymous'), avatar_url: null }
    return myAuthorRef.current
  }

  // 새 댓글/답글 작성. parentId가 있으면 답글.
  const addComment = async (content: string, parentId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t('loginRequired')); return false }

    const { data, error: insErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content, parent_id: parentId })
      .select('*')
      .single()
    if (insErr || !data) { setError(t('saveCommentFailed')); return false }

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
    if (!content || sendingReply) return // 중복 등록 방지(더블클릭·Enter+클릭)
    setSendingReply(true); setError(null)
    if (await addComment(content, parentId)) {
      setReplyText('')
      setReplyTo(null)
    }
    setSendingReply(false)
  }

  const saveEdit = async (id: string) => {
    if (savingEdit) return
    const content = editText.trim()
    if (!content) return
    setSavingEdit(true)
    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('comments')
      .update({ content, updated_at: now })
      .eq('id', id)
    setSavingEdit(false)
    if (updErr) { setError(t('editFailed')); return }
    setComments(prev => prev.map(c => c.id === id ? { ...c, content, updated_at: now } : c))
    setEditingId(null)
  }

  const remove = async (id: string) => {
    setConfirmDeleteId(null)
    const prev = comments
    // 부모를 지우면 답글도 함께 제거(DB는 cascade, UI도 동일하게)
    setComments(c => c.filter(x => x.id !== id && x.parent_id !== id))
    const { error: delErr } = await supabase.from('comments').delete().eq('id', id)
    if (delErr) { setComments(prev); setError(t('deleteCommentFailed')) }
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
              {c.author?.display_name ?? t('anonymous')}
            </span>
            <TimeAgo iso={c.created_at} className="text-xs text-gray-400" />
            {isEdited(c) && <span className="text-xs text-gray-300">{t('edited')}</span>}
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
              <button onClick={() => saveEdit(c.id)} disabled={savingEdit} className="btn-primary px-3 text-sm shrink-0 disabled:opacity-60">{savingEdit ? tc('saving') : tc('save')}</button>
              <button onClick={() => { if (!savingEdit) setEditingId(null) }} className="text-xs text-gray-400 shrink-0">{tc('cancel')}</button>
            </div>
          ) : (
            <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
          )}

          {/* 액션 */}
          {!editing && (
            <div className="flex items-center gap-1 mt-1 -ml-1.5">
              {!isReply && (
                <button
                  onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') }}
                  className="text-xs text-gray-400 hover:text-primary-600 px-1.5 py-1.5"
                >
                  {t('reply')}
                </button>
              )}
              {mine && (
                <>
                  <button
                    onClick={() => { setEditingId(c.id); setEditText(c.content) }}
                    className="text-xs text-gray-400 hover:text-primary-600 px-1.5 py-1.5"
                  >
                    {t('edit')}
                  </button>
                  {confirmDeleteId === c.id ? (
                    <>
                      <span className="text-xs text-gray-500">{t('deleteConfirmShort')}</span>
                      {/* 파괴적 동작은 채운 빨강 알약으로 명확히 구분(취소와 헷갈리지 않게) */}
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-1.5"
                      >
                        {tc('delete')}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-500 px-1.5 py-1.5"
                      >
                        {tc('cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1.5"
                    >
                      {tc('delete')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 답글 입력 */}
          {replyTo === c.id && (
            <div className="mt-2 flex gap-2">
              <input
                className="input flex-1 py-1.5 text-sm"
                placeholder={t('replyPlaceholder')}
                value={replyText}
                maxLength={1000}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitReply(c.id) }}
                autoFocus
              />
              <button
                onClick={() => submitReply(c.id)}
                disabled={!replyText.trim() || sendingReply}
                className="btn-primary px-3 text-sm shrink-0"
              >
                {t('submit')}
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
        {t('comment')} <span className="text-primary-500">{comments.length}</span>
      </h3>

      {/* 입력 — 여러 줄 작성이 가능하도록 textarea. 한 줄에서 시작해 내용에 따라 자동으로 늘어난다. */}
      <form onSubmit={submitTop} className="flex items-end gap-2">
        <textarea
          className="input flex-1 resize-none min-h-[42px] max-h-40 leading-snug"
          rows={1}
          placeholder={t('commentPlaceholder')}
          maxLength={1000}
          value={text}
          onChange={e => {
            setText(e.target.value)
            // 내용 높이에 맞춰 자동 확장 (최대 높이는 CSS max-h로 제한)
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 shrink-0">
          {t('submit')}
        </button>
      </form>
      {error && <p className="text-sm text-red-500 -mt-2">{error}</p>}

      {/* 목록 */}
      <div className="space-y-4">
        {topLevel.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('emptyComments')}</p>
        ) : (
          topLevel.map(c => renderComment(c, false))
        )}
      </div>
    </div>
  )
}

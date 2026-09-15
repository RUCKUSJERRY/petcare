'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type Thread = { id: string; title: string | null; updated_at: string }

/**
 * Claude.ai 식 좌측 대화 목록 드로어. 열릴 때 최근 대화를 불러오고,
 * 대화를 누르면 /chat?t=id 로 이어보기(상위 페이지가 key 로 리마운트). 각 대화는 삭제 가능.
 */
export function ChatHistoryDrawer({
  open,
  onClose,
  currentThreadId,
}: {
  open: boolean
  onClose: () => void
  currentThreadId: string
}) {
  const t = useTranslations('chat')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const router = useRouter()
  const [pendingDelete, setPendingDelete] = useState<Thread | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: threads = [] } = useQuery({
    queryKey: ['chat-threads'],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('chat_threads')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50)
      return (data ?? []) as Thread[]
    },
  })

  const doDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const supabase = createClient()
    // 메시지 먼저 지우고(캐스케이드가 있어도 방어적으로) 스레드 삭제. RLS 로 본인 것만.
    await supabase.from('chat_messages').delete().eq('thread_id', pendingDelete.id)
    const { error } = await supabase.from('chat_threads').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    const deletedCurrent = pendingDelete.id === currentThreadId
    setPendingDelete(null)
    if (!error) {
      qc.invalidateQueries({ queryKey: ['chat-threads'] })
      qc.removeQueries({ queryKey: ['chat-thread', pendingDelete.id] })
      // 지금 보고 있는 대화를 지웠으면 새 대화로 이동.
      if (deletedCurrent) { onClose(); router.push('/chat') }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex" onClick={onClose}>
      <div
        className="w-72 max-w-[80%] h-full bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-900">{t('historyTitle')}</span>
          <button onClick={onClose} aria-label={t('back')} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>
        <Link
          href="/chat"
          onClick={onClose}
          className="btn-primary text-sm py-2 text-center rounded-lg m-3"
        >
          ＋ {t('newChat')}
        </Link>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {threads.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">{t('historyEmpty')}</p>
          ) : (
            threads.map(th => {
              const active = th.id === currentThreadId
              return (
                <div
                  key={th.id}
                  className={`flex items-center rounded-lg transition-colors ${active ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  <Link
                    href={`/chat?t=${th.id}`}
                    onClick={onClose}
                    className={`flex-1 min-w-0 px-3 py-2 text-sm truncate ${active ? 'text-primary-700 font-semibold' : 'text-gray-700'}`}
                  >
                    {th.title || t('untitled')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(th)}
                    aria-label={t('delete')}
                    className="shrink-0 px-2.5 py-2 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
      {/* 바깥(오른쪽) 영역 — 눌러서 닫기 */}
      <div className="flex-1" />

      {/* 삭제 확인 — 드로어(z-60) 위에 뜨도록 z-80 */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
          onClick={() => { if (!deleting) setPendingDelete(null) }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <p className="font-bold text-gray-900 text-lg">{t('deleteConfirmTitle')}</p>
              <p className="text-sm text-gray-500 truncate">{pendingDelete.title || t('untitled')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium disabled:opacity-60"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="py-3 rounded-xl text-sm font-semibold text-white bg-red-500 disabled:opacity-60"
              >
                {deleting ? t('deleting') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

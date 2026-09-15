'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type Thread = { id: string; title: string | null; updated_at: string }

/**
 * Claude.ai 식 좌측 대화 목록 드로어. 열릴 때 최근 대화를 불러오고,
 * 대화를 누르면 /chat?t=id 로 이어보기(상위 페이지가 key 로 리마운트).
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
  const { data: threads = [] } = useQuery({
    queryKey: ['chat-threads'],
    enabled: open,
    // 새 대화/메시지 후 다시 열면 최신이 보이도록 매번 새로 불러온다.
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
            threads.map(th => (
              <Link
                key={th.id}
                href={`/chat?t=${th.id}`}
                onClick={onClose}
                className={`block rounded-lg px-3 py-2 text-sm truncate transition-colors ${
                  th.id === currentThreadId
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {th.title || t('untitled')}
              </Link>
            ))
          )}
        </div>
      </div>
      {/* 바깥(오른쪽) 영역 — 눌러서 닫기 */}
      <div className="flex-1" />
    </div>
  )
}

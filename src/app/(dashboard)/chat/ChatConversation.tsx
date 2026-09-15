'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { ChatHistoryDrawer } from './ChatHistoryDrawer'

// 챗봇이 도구(기록 생성/산책)로 데이터를 바꿀 수 있으므로, 응답 완료 시 관련 캐시를 무효화해
// 홈·타임라인·일정 등이 다음 진입 때 최신으로 보이게 한다(챗은 별도 화면이라 비용 부담 낮음).
const RECORD_CACHE_KEYS = [
  'today-log', 'today-timeline', 'record-feed', 'care-schedule',
  'life-pattern', 'weekly-report', 'monthly-recap', 'cost-records',
  'walks', 'today-walk', 'pet-care-points', 'achievements',
]

// 제안 프롬프트 — 빈 화면에서 무엇을 물어볼 수 있는지 안내(첫 사용 진입장벽 완화)
const SUGGESTIONS = [
  '강아지 양치, 어떻게 시작하면 좋을까?',
  '고양이가 사료를 잘 안 먹어요',
  '산책은 하루에 얼마나 시켜야 해?',
  '중성화 수술 후 주의할 점 알려줘',
]

/** UIMessage 의 텍스트 파트만 합쳐 문자열로 */
function messageText(parts: { type: string; text?: string }[]): string {
  return parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('')
}

/**
 * 한 대화 스레드의 채팅 UI. threadId 로 서버가 대화를 저장/이어쓰기 하고,
 * initialMessages 로 이전 대화를 복원한다. (threadId 가 바뀌면 상위에서 key 로 리마운트)
 */
export function ChatConversation({
  threadId,
  initialMessages,
}: {
  threadId: string
  initialMessages: UIMessage[]
}) {
  const t = useTranslations('chat')
  const qc = useQueryClient()
  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    // threadId 를 함께 보내 서버가 이 스레드에 대화를 저장하게 한다.
    transport: new DefaultChatTransport({ api: '/api/chat', body: { threadId } }),
    // 응답 완료 시 기록 관련 캐시 무효화(챗봇이 기록을 생성했을 수 있으므로) + 대화 목록 갱신.
    onFinish: () => {
      RECORD_CACHE_KEYS.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      qc.invalidateQueries({ queryKey: ['chat-threads'] })
    },
  })
  const [input, setInput] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const submit = (text: string) => {
    const v = text.trim()
    if (!v || busy) return
    sendMessage({ text: v })
    setInput('')
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] px-4">
      {/* 상단 툴바 — AppHeader(56px) 아래에 고정돼 스크롤해도 '기록/새 대화'가 항상 보인다. */}
      <div className="sticky top-[56px] z-30 bg-gray-50 flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t('history')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 flex-1 truncate">{t('title')}</h1>
        <Link
          href="/chat"
          aria-label={t('newChat')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      </div>

      {/* 좌측 대화 목록 드로어 */}
      <ChatHistoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currentThreadId={threadId} />

      {/* 대화 영역 */}
      <div className="flex-1 space-y-3 pb-28">
        {messages.length === 0 && (
          <div className="pt-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-4xl" aria-hidden>🐾</div>
              <p className="text-sm text-gray-600">{t('empty')}</p>
              <p className="text-[11px] text-gray-400 px-6">{t('disclaimer')}</p>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="w-full text-left text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-primary-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const mine = m.role === 'user'
          return (
            <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  mine ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {messageText(m.parts) || (m.role === 'assistant' && busy ? '…' : '')}
              </div>
            </div>
          )
        })}

        {status === 'submitted' && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">…</div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 입력 바 — 하단 탭 위에 고정 */}
      <form
        onSubmit={e => { e.preventDefault(); submit(input) }}
        className="sticky bottom-20 bg-gray-50 py-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input) }
            }}
            rows={1}
            placeholder={t('placeholder')}
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary-400 max-h-32"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary shrink-0 rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-40"
            aria-label={t('send')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/client'
import { ChatConversation } from './ChatConversation'

type DbMessage = { id: string; role: 'user' | 'assistant'; content: string }

/** DB 대화 행 → useChat 초기 메시지(UIMessage) */
function toUIMessage(r: DbMessage): UIMessage {
  return { id: r.id, role: r.role, parts: [{ type: 'text', text: r.content }] } as UIMessage
}

function ChatInner() {
  const params = useSearchParams()
  const threadParam = params.get('t')
  // 새 대화는 클라이언트에서 스레드 id 를 만들어(서버가 이 id 로 저장), 이어보기는 URL 의 t 를 쓴다.
  const newId = useMemo(() => crypto.randomUUID(), [])
  const threadId = threadParam || newId

  // 이어보기(t 있음)면 이전 메시지를 불러온다. 실패/미적용이면 빈 대화로 시작(무중단).
  const { data: initial = [], isLoading } = useQuery({
    queryKey: ['chat-thread', threadParam],
    enabled: !!threadParam,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('thread_id', threadParam!)
        .order('created_at', { ascending: true })
      return ((data ?? []) as DbMessage[]).map(toUIMessage)
    },
  })

  if (threadParam && isLoading) {
    return <div className="px-4 py-16 text-center text-gray-400 text-sm">불러오는 중…</div>
  }

  return <ChatConversation key={threadId} threadId={threadId} initialMessages={threadParam ? initial : []} />
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="px-4 py-16 text-center text-gray-400 text-sm">불러오는 중…</div>}>
      <ChatInner />
    </Suspense>
  )
}

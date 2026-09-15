import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isoToKstDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'

/** 저장된 AI 도우미 대화 목록 — 최근 대화부터. 눌러서 이어보기(/chat?t=id). */
export default async function ChatHistoryPage() {
  const t = await getTranslations('chat')
  const supabase = await createServerSupabaseClient()

  // chat_threads 미적용/오류여도 화면은 뜬다(빈 목록). 메시지 없는 빈 스레드는 제외.
  const { data } = await supabase
    .from('chat_threads')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)
  const threads = (data ?? []) as { id: string; title: string | null; updated_at: string }[]

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/chat" aria-label={t('back')} className="text-gray-400 shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{t('historyTitle')}</h1>
        <Link href="/chat" className="text-xs font-semibold text-primary-600 shrink-0 px-2 py-1">
          {t('newChat')}
        </Link>
      </div>

      {threads.length === 0 ? (
        <EmptyState icon="💬" title={t('historyEmpty')} />
      ) : (
        <div className="space-y-2">
          {threads.map(th => (
            <Link
              key={th.id}
              href={`/chat?t=${th.id}`}
              className="card flex items-center gap-3 py-3 hover:shadow-md transition-shadow"
            >
              <span className="text-xl shrink-0" aria-hidden>💬</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 truncate">{th.title || t('untitled')}</div>
                <div className="text-xs text-gray-500 mt-0.5">{isoToKstDate(th.updated_at)}</div>
              </div>
              <span aria-hidden className="text-gray-300 shrink-0">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { cn, timeAgo } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { NotificationItem } from '@/types'

const typeTextKey: Record<string, string> = {
  comment: 'notifTypeComment',
  reply: 'notifTypeReply',
  like: 'notifTypeLike',
}
const typeIcon: Record<string, string> = { comment: '💬', reply: '↩️', like: '❤️' }

export function NotificationBell() {
  const t = useTranslations('ui')
  const supabase = createClient()
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const active = open || pathname.startsWith('/notifications')

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
      return count ?? 0
    },
    refetchInterval: 60_000,
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_list')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as NotificationItem[]
    },
    enabled: open, // 드롭다운을 열 때만 조회
  })

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
  }

  const markAllRead = async () => {
    const ids = items.filter(n => !n.read).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    refresh()
  }

  const openItem = async (n: NotificationItem) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      refresh()
    }
    setOpen(false)
    if (n.post_id) router.push(`/community/${n.post_id}`)
  }

  const recent = items.slice(0, 8)

  return (
    <div data-tour="bell" className="relative shrink-0" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-8 h-8 rounded-full border flex items-center justify-center transition-colors',
          active
            ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 text-primary-600'
            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
        )}
        aria-label={unread > 0 ? t('notifBellCount', { count: unread }) : t('notifBell')}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('notifBell')}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">{t('notifBell')}</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-600 font-semibold">
                {t('notifMarkAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">{t('notifLoading')}</div>
            ) : recent.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">{t('notifEmpty')}</p>
              </div>
            ) : (
              recent.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left flex items-start gap-2.5 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    n.read ? '' : 'bg-primary-50/50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {n.actor_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.actor_avatar} alt={n.actor_name ?? t('notifAnonymous')} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">{typeIcon[n.type]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">
                      <span aria-hidden className="mr-1">{typeIcon[n.type]}</span>
                      <span className="font-semibold">{n.actor_name ?? t('notifAnonymous')}</span>
                      {t(typeTextKey[n.type])}
                    </p>
                    {n.post_title && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">“{n.post_title}”</p>
                    )}
                    <p className="text-xs text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-sm text-primary-600 font-semibold py-2.5 border-t border-gray-100 hover:bg-gray-50"
          >
            {t('notifViewAll')}
          </Link>
        </div>
      )}
    </div>
  )
}

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
  sighting: 'notifTypeSighting',
}
const typeIcon: Record<string, string> = { comment: '💬', reply: '↩️', like: '❤️', sighting: '📍' }

/** 알림이 가리키는 대상 화면 (없으면 이동하지 않음) */
const notificationTarget = (n: NotificationItem): string | null =>
  n.type === 'sighting'
    ? (n.lost_pet_id ? `/lost/${n.lost_pet_id}` : null)
    : (n.post_id ? `/community/${n.post_id}` : null)

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
      // recipient_id 를 명시해 '내 안읽음'만 센다 — markAllRead 와 동일하게 RLS 만 믿지 않고
      // (정책 회귀 시 남의 알림까지 배지에 잡히는 사고 방지) 코드에서도 본인 것만 집계함을 보장한다.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 0
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false)
      return count ?? 0
    },
    refetchInterval: 60_000,
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      // 드롭다운 목록도 recipient_id 로 내 알림만 조회(위와 동일한 방어적 필터).
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase
        .from('notification_list')
        .select('*')
        .eq('recipient_id', user.id)
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
    // 로드된 목록(최대 50건)만이 아니라 내 안읽음 전체를 서버에서 읽음 처리한다.
    // (예전엔 로드된 id 만 갱신해 50건 초과이거나 목록이 아직 안 불러와진 상태에서 배지가 그대로 남았다.)
    // recipient_id 를 명시해 방어적으로 내 알림만 대상으로 한다 — RLS 만 믿지 않고(정책 회귀 시
    // 남의 알림까지 읽음 처리되는 사고 방지), 본인 것만 갱신됨을 코드에서도 보장한다.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false)
    refresh()
  }

  const openItem = (n: NotificationItem) => {
    // 탭 즉시 이동한다. 읽음 처리는 사용자에게 보이지 않는 부수작업이라 왕복을 기다릴 필요가
    // 없다 — 낙관적으로 배지/목록을 먼저 갱신하고 서버 쓰기는 백그라운드로 돌린다.
    setOpen(false)
    const target = notificationTarget(n)
    if (target) router.push(target)
    if (!n.read) {
      qc.setQueryData<NotificationItem[]>(['notifications'], prev =>
        prev?.map(it => (it.id === n.id ? { ...it, read: true } : it)))
      // 배지 카운트가 아직 로드되지 않았으면(undefined) 임의로 0으로 만들지 않는다 —
      // 로드 전 '1→0' 가정은 실제 미읽음 수와 무관하게 배지를 꺼버린다. 값이 있을 때만 1 줄인다.
      qc.setQueryData<number>(['notifications-unread'], c => (c == null ? c : Math.max(0, c - 1)))
      supabase.from('notifications').update({ read: true }).eq('id', n.id)
        .then(() => {
          // 배지 수뿐 아니라 목록 캐시도 서버와 재조정한다 — 낙관적 패치만 남으면 전체
          // 알림 화면(/notifications)·드롭다운의 읽음 표시가 서버 상태와 어긋날 수 있다.
          qc.invalidateQueries({ queryKey: ['notifications-unread'] })
          qc.invalidateQueries({ queryKey: ['notifications'] })
        })
    }
  }

  const recent = items.slice(0, 8)

  return (
    <div data-tour="bell" className="relative shrink-0" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-10 h-10 rounded-full border flex items-center justify-center transition-colors',
          active
            ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 text-primary-600'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
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
                      <span className="text-sm">{typeIcon[n.type] ?? '🔔'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">
                      <span aria-hidden className="mr-1">{typeIcon[n.type] ?? '🔔'}</span>
                      <span className="font-semibold">{n.actor_name ?? t('notifAnonymous')}</span>
                      {typeTextKey[n.type] ? t(typeTextKey[n.type]) : ''}
                    </p>
                    {(n.type === 'sighting' ? n.lost_pet_name : n.post_title) && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        “{n.type === 'sighting' ? n.lost_pet_name : n.post_title}”
                      </p>
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

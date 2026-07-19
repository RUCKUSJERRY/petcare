'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { timeAgo } from '@/lib/utils'
import type { NotificationItem } from '@/types'

const typeIcon: Record<string, string> = { comment: '💬', reply: '↩️', like: '❤️' }

export default function NotificationsPage() {
  const supabase = createClient()
  const qc = useQueryClient()
  const router = useRouter()
  const t = useTranslations('notifications')
  const typeText: Record<string, string> = {
    comment: t('typeComment'),
    reply: t('typeReply'),
    like: t('typeLike'),
  }

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_list')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      // 네트워크/RLS 오류를 던져 isError 로 표면화 — 던지지 않으면 실패가 '알림 없음'과
      // 구분되지 않아 빈 상태('🔔 알림이 없어요')로 잘못 표시된다.
      if (error) throw error
      return (data ?? []) as NotificationItem[]
    },
  })

  const unread = items.filter(n => !n.read).length

  const markAllRead = async () => {
    // 로드된 목록(최대 50건)만이 아니라 내 안읽음 전체를 서버에서 읽음 처리한다.
    // (RLS 로 내 알림만 대상 — 예전엔 로드된 id 만 갱신해 50건을 초과하면 배지가 그대로 남았다.
    //  알림 종 드롭다운(NotificationBell)과 동일한 방식으로 통일.)
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
  }

  const open = (n: NotificationItem) => {
    // 탭 즉시 이동한다. 읽음 처리는 사용자에게 보이지 않는 부수작업이라 왕복을 기다릴 필요가
    // 없다 — 낙관적으로 목록/배지를 먼저 갱신하고 서버 쓰기는 백그라운드로 돌린다.
    if (n.post_id) router.push(`/community/${n.post_id}`)
    if (!n.read) {
      qc.setQueryData<NotificationItem[]>(['notifications'], prev =>
        prev?.map(it => (it.id === n.id ? { ...it, read: true } : it)))
      qc.setQueryData<number>(['notifications-unread'], c => Math.max(0, (c ?? 1) - 1))
      supabase.from('notifications').update({ read: true }).eq('id', n.id)
        .then(() => qc.invalidateQueries({ queryKey: ['notifications-unread'] }))
    }
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-primary-600 font-semibold shrink-0">
            {t('markAllRead')}
          </button>
        )}
      </div>

      {isLoading ? (
        <CardSkeletonList count={5} />
      ) : isError ? (
        <EmptyState variant="error" title={t('loadError')} />
      ) : items.length === 0 ? (
        <EmptyState icon="🔔" title={t('empty')} />
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`w-full text-left card flex items-start gap-3 transition-colors ${
                n.read ? '' : 'bg-primary-50/60 border-primary-100'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {n.actor_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.actor_avatar} alt={n.actor_name ?? t('anonymous')} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base">{typeIcon[n.type]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">
                  <span aria-hidden className="mr-1">{typeIcon[n.type]}</span>
                  <span className="font-semibold">{n.actor_name ?? t('anonymous')}</span>
                  {typeText[n.type]}
                </p>
                {n.post_title && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">“{n.post_title}”</p>
                )}
                <p className="text-xs text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  })

  const unread = items.filter(n => !n.read).length

  const markAllRead = async () => {
    const ids = items.filter(n => !n.read).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
  }

  const open = async (n: NotificationItem) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    }
    if (n.post_id) router.push(`/community/${n.post_id}`)
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

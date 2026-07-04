'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, todayKST } from '@/lib/utils'

type Row = {
  id: string
  pet_id: string
  category: string
  title: string
  event_at: string | null
  memo: string | null
  pet: { name: string; species: string } | null
}

const hhmm = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 오늘 하루의 기록을 시간순(최신 위)으로 보여주는 타임라인.
 * petId 가 있으면 그 아이만, 없으면 내 모든 아이의 오늘 기록(아이 이름 표기)을 보여준다.
 * 한 줄을 누르면 상세 모달을 연다.
 */
export function TodayTimeline({
  petId,
  showPetName = false,
  tone = 'plain',
  limit,
  onSelect,
}: {
  petId: string | null
  showPetName?: boolean
  tone?: 'plain' | 'onPrimary'
  /** 표시할 최대 개수(홈 인라인용). 초과분은 '+N건 더'로 안내 */
  limit?: number
  onSelect: (id: string) => void
}) {
  const t = useTranslations('quickLog')
  const supabase = createClient()
  const onP = tone === 'onPrimary'

  const { data: rows = [], isPending } = useQuery({
    queryKey: ['today-timeline', petId],
    queryFn: async () => {
      let q = supabase
        .from('records')
        .select('id, pet_id, category, title, event_at, memo, pet:pets(name, species)')
        .eq('event_on', todayKST())
        .order('event_at', { ascending: false, nullsFirst: false })
      if (petId) q = q.eq('pet_id', petId)
      const { data } = await q
      return (data ?? []) as unknown as Row[]
    },
  })

  // 첫 로딩 중에는 빈 상태("오늘은 아직 기록이 없어요") 대신 조용히 비워둔다 —
  // 캐시 미스마다 "기록 없음"이 번쩍여 사용자가 중복 기록하거나 저장 실패로 오인하는 것을 막는다.
  if (isPending) {
    if (onP) return <div className="h-6" aria-hidden />
    return <div className="card h-24 animate-pulse bg-gray-50" aria-hidden />
  }

  if (rows.length === 0) {
    // 홈 인라인(onPrimary)에서는 카드가 커지지 않게 한 줄 힌트만
    if (onP) return <p className="text-xs text-white/70 py-1">{t('emptyTodayHint')}</p>
    return (
      <div className="card text-center py-10 text-gray-400">
        <div className="text-3xl mb-2">🐾</div>
        <p className="text-sm">{t('emptyToday')}</p>
        <p className="text-xs mt-1.5">{t('emptyTodayHint')}</p>
      </div>
    )
  }

  const shown = limit ? rows.slice(0, limit) : rows
  const more = rows.length - shown.length

  // 시간순 흐름이 보이도록 좌측에 점·세로선(타임라인) 표시
  const rowCls = onP
    ? 'flex items-center gap-2.5 rounded-lg bg-white/12 hover:bg-white/20 px-2.5 py-1.5 transition-colors'
    : 'card flex items-center gap-3 hover:shadow-md transition-shadow'

  return (
    <div className={onP ? 'space-y-1.5' : 'space-y-2'}>
      {shown.map(r => (
        <button key={r.id} onClick={() => onSelect(r.id)} className="w-full text-left">
          <div className={rowCls}>
            <span className={`text-xs font-semibold tabular-nums shrink-0 text-center ${onP ? 'text-white/80 w-9' : 'text-gray-400 w-10'}`}>
              {hhmm(r.event_at)}
            </span>
            <span className={`shrink-0 ${onP ? 'text-base' : 'text-xl'}`} aria-hidden>{careCategoryIcon(r.category)}</span>
            <div className="flex-1 min-w-0">
              {onP ? (
                <p className="text-sm font-medium text-white truncate">
                  {showPetName && r.pet ? `${r.pet.name} · ` : ''}{r.title}
                  {r.memo ? <span className="text-white/60"> · {r.memo}</span> : ''}
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    {showPetName && r.pet && (
                      <>
                        <span className="text-xs text-gray-400">{r.pet.species === 'cat' ? '🐱' : '🐶'} {r.pet.name}</span>
                        <span className="text-xs text-gray-300">·</span>
                      </>
                    )}
                    <span className="text-xs text-gray-400">{r.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                  {r.memo && <p className="text-xs text-gray-400 truncate">{r.memo}</p>}
                </>
              )}
            </div>
            <span aria-hidden className={onP ? 'text-white/40 shrink-0' : 'text-gray-300 shrink-0'}>›</span>
          </div>
        </button>
      ))}
      {more > 0 && (
        <p className={`text-xs text-center pt-0.5 ${onP ? 'text-white/70' : 'text-gray-400'}`}>
          {t('moreCount', { count: more })}
        </p>
      )}
    </div>
  )
}

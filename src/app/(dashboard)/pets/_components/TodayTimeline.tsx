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
  onSelect,
}: {
  petId: string | null
  showPetName?: boolean
  onSelect: (id: string) => void
}) {
  const t = useTranslations('quickLog')
  const supabase = createClient()

  const { data: rows = [] } = useQuery({
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

  if (rows.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-400">
        <div className="text-3xl mb-2">🐾</div>
        <p className="text-sm">{t('emptyToday')}</p>
        <p className="text-xs mt-1.5">{t('emptyTodayHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <button key={r.id} onClick={() => onSelect(r.id)} className="w-full text-left">
          <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="text-xs font-semibold text-gray-400 tabular-nums w-10 shrink-0 text-center">
              {hhmm(r.event_at)}
            </span>
            <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(r.category)}</span>
            <div className="flex-1 min-w-0">
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
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

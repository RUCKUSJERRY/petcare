'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { careCategoryIcon, daysUntil, ddayBadge, ddayToneClass } from '@/lib/utils'
import type { CareCategory } from '@/types'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  category: CareCategory
  vaccine_name: string
  next_due_on: string
}

export default function SchedulePage() {
  const supabase = createClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['care-schedule'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as ScheduleItem[]

      const { data: pets } = await supabase
        .from('pets')
        .select('id, name, species')
        .eq('user_id', user.id)
      const petList = (pets ?? []) as { id: string; name: string; species: string }[]
      if (petList.length === 0) return [] as ScheduleItem[]

      const petMap = new Map(petList.map(p => [p.id, p]))
      const { data: records } = await supabase
        .from('vaccination_records')
        .select('id, pet_id, category, vaccine_name, next_due_on')
        .in('pet_id', petList.map(p => p.id))
        .not('next_due_on', 'is', null)
        .order('next_due_on', { ascending: true })

      return ((records ?? []) as Omit<ScheduleItem, 'pet_name' | 'pet_species'>[])
        .map(r => ({
          ...r,
          pet_name: petMap.get(r.pet_id)?.name ?? '',
          pet_species: petMap.get(r.pet_id)?.species ?? 'dog',
        })) as ScheduleItem[]
    },
  })

  // 지남 / 다가오는 일정으로 그룹
  const overdue = items.filter(i => daysUntil(i.next_due_on) < 0)
  const upcoming = items.filter(i => daysUntil(i.next_due_on) >= 0)

  const Row = ({ i }: { i: ScheduleItem }) => {
    const badge = ddayBadge(i.next_due_on)
    return (
      <Link href={`/pets/${i.pet_id}`}>
        <div className="card flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="text-xl shrink-0" aria-hidden>{careCategoryIcon(i.category)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{i.pet_species === 'cat' ? '🐱' : '🐶'} {i.pet_name}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{i.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{i.vaccine_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{i.next_due_on}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
            {badge.text}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <PageHeader title="건강 일정" fallbackHref="/dashboard" />

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗓️</div>
          다음 예정일이 등록된 건강 기록이 없어요.
          <p className="text-xs mt-2">아이 상세 → 건강 관리 기록에서 다음 예정일을 등록해보세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-red-500">지난 일정 {overdue.length}</h2>
              <div className="space-y-2">{overdue.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">다가오는 일정</h2>
              <div className="space-y-2">{upcoming.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

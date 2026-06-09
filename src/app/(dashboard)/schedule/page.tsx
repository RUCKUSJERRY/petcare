'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
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
  const { selectedPetId } = useSelectedPet()
  const [filter, setFilter] = useState<string>('all') // 'all' | petId
  const initialized = useRef(false)

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

  // 일정이 있는 펫 목록 (필터 칩용)
  const petsInItems = Array.from(
    new Map(items.map(i => [i.pet_id, { id: i.pet_id, name: i.pet_name, species: i.pet_species }])).values()
  )

  // 최초 로드 시: 선택된 아이에게 일정이 있으면 그 아이 기준으로 시작
  useEffect(() => {
    if (initialized.current || items.length === 0) return
    initialized.current = true
    if (selectedPetId && items.some(i => i.pet_id === selectedPetId)) {
      setFilter(selectedPetId)
    }
  }, [items, selectedPetId])

  const visible = filter === 'all' ? items : items.filter(i => i.pet_id === filter)

  // 지남 / 다가오는 일정으로 그룹
  const overdue = visible.filter(i => daysUntil(i.next_due_on) < 0)
  const upcoming = visible.filter(i => daysUntil(i.next_due_on) >= 0)

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

      {/* 펫 필터 (2마리 이상 일정이 있을 때만) */}
      {!isLoading && petsInItems.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === 'all' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            전체
          </button>
          {petsInItems.map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {p.species === 'cat' ? '🐱' : '🐶'} {p.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗓️</div>
          다음 예정일이 등록된 건강 기록이 없어요.
          <p className="text-xs mt-2">아이 상세 → 건강 관리 기록에서 다음 예정일을 등록해보세요.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          이 아이는 예정된 건강 일정이 없어요.
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

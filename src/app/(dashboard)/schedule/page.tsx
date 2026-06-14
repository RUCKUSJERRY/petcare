'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { addDays, careRecommendedCycleDays, cn, careCategoryIcon, daysUntil, ddayBadge, ddayToneClass } from '@/lib/utils'
import { ScheduleAddForm } from './_components/ScheduleAddForm'
import { ScheduleCalendar } from './_components/ScheduleCalendar'
import { useTranslations } from 'next-intl'

type View = 'list' | 'calendar'

type ScheduleItem = {
  id: string
  pet_id: string
  pet_name: string
  pet_species: string
  kind: 'care' | 'medical'
  category: string
  title: string
  last_on: string | null   // 마지막 시행/진료일
  next_due_on: string      // 다음 예정(또는 권장)일 — 정렬·배지 기준
  estimated: boolean       // next_due가 권장주기로 추정된 값인지
}

export default function SchedulePage() {
  const supabase = createClient()
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const { selectedPetId } = useSelectedPet()
  const [view, setView] = useState<View>('list')
  const [adding, setAdding] = useState(false)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['care-schedule'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as ScheduleItem[]

      // 멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환 (공동 관리로 초대받은 아이 포함)
      const { data: pets } = await supabase
        .from('pets')
        .select('id, name, species')
      const petList = (pets ?? []) as { id: string; name: string; species: string }[]
      if (petList.length === 0) return [] as ScheduleItem[]
      const petMap = new Map(petList.map(p => [p.id, p]))
      const petIds = petList.map(p => p.id)
      const meta = (petId: string) => ({
        pet_name: petMap.get(petId)?.name ?? '',
        pet_species: petMap.get(petId)?.species ?? 'dog',
      })

      // ── 관리 기록(접종·구충·미용·양치 등): 항목 라인별 "최신 시행 기록"만 ──
      const { data: careRows } = await supabase
        .from('vaccination_records')
        .select('id, pet_id, category, vaccine_name, vaccinated_on, next_due_on')
        .in('pet_id', petIds)
        .order('vaccinated_on', { ascending: false })

      type CareRow = { id: string; pet_id: string; category: string; vaccine_name: string; vaccinated_on: string; next_due_on: string | null }
      const latest = new Map<string, CareRow>()
      for (const r of (careRows ?? []) as CareRow[]) {
        const key = `${r.pet_id}|${r.category}|${r.vaccine_name}`
        if (!latest.has(key)) latest.set(key, r) // 시행일 내림차순 → 첫 항목이 최신
      }

      const careItems: ScheduleItem[] = []
      for (const r of Array.from(latest.values())) {
        const cycle = careRecommendedCycleDays(r.category)
        // 다음 예정일: 명시값 우선, 없으면 권장주기로 추정 (양치·미용 등 "한지 N일" 표시용)
        const due = r.next_due_on ?? (cycle ? addDays(r.vaccinated_on, cycle) : null)
        if (!due) continue
        careItems.push({
          id: r.id, pet_id: r.pet_id, ...meta(r.pet_id),
          kind: 'care', category: r.category, title: r.vaccine_name,
          last_on: r.vaccinated_on, next_due_on: due,
          estimated: !r.next_due_on && !!cycle,
        })
      }

      // ── 진료 기록: 다음 내원 예정일 ──
      const { data: medRows } = await supabase
        .from('medical_records')
        .select('id, pet_id, visited_on, next_visit_on, diagnosis, reason')
        .in('pet_id', petIds)
        .not('next_visit_on', 'is', null)

      type MedRow = { id: string; pet_id: string; visited_on: string; next_visit_on: string; diagnosis: string | null; reason: string | null }
      const medItems: ScheduleItem[] = ((medRows ?? []) as MedRow[]).map(m => ({
        id: m.id, pet_id: m.pet_id, ...meta(m.pet_id),
        kind: 'medical' as const, category: '진료',
        title: m.diagnosis || m.reason || t('medicalFallback'),
        last_on: m.visited_on, next_due_on: m.next_visit_on, estimated: false,
      }))

      return [...careItems, ...medItems].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))
    },
  })

  // 상단바에서 선택한 아이가 있으면 그 아이 일정만, 없으면 전체
  const visible = selectedPetId ? items.filter(i => i.pet_id === selectedPetId) : items
  const selectedName = selectedPetId ? items.find(i => i.pet_id === selectedPetId)?.pet_name : null

  // 지남 / 임박(7일 이내) / 예정으로 그룹
  const overdue = visible.filter(i => daysUntil(i.next_due_on) < 0)
  const soon = visible.filter(i => {
    const d = daysUntil(i.next_due_on)
    return d >= 0 && d <= 7
  })
  const later = visible.filter(i => daysUntil(i.next_due_on) > 7)

  const Row = ({ i }: { i: ScheduleItem }) => {
    const badge = ddayBadge(i.next_due_on)
    const daysSince = i.last_on ? Math.max(0, -daysUntil(i.last_on)) : null
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
            <p className="text-sm font-semibold text-gray-900 truncate">{i.title}</p>
            {/* 마지막 시행 후 경과 + 다음 예정(권장이면 표시) */}
            <p className="text-xs text-gray-400 mt-0.5">
              {daysSince != null && (
                <>{t('lastLabel')} {daysSince === 0 ? t('today') : t('daysAgo', { n: daysSince })} · </>
              )}
              {t('nextLabel')} {i.next_due_on}{i.estimated && <span className="text-gray-300"> {t('recommended')}</span>}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
            {badge.text}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} fallbackHref="/dashboard" />
        {selectedName && (
          <span className="text-sm text-primary-600 font-medium shrink-0">{t('petBasis', { name: selectedName })}</span>
        )}
      </div>

      {/* 보기 전환 + 추가 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
          {([['list', t('viewList')], ['calendar', t('viewCalendar')]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
                view === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          className={cn('text-sm py-1.5 px-3 shrink-0', adding ? 'btn-secondary' : 'btn-primary')}
        >
          {adding ? tc('close') : t('addSchedule')}
        </button>
      </div>

      {adding && (
        <ScheduleAddForm defaultPetId={selectedPetId} onClose={() => setAdding(false)} />
      )}

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : visible.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🗓️</div>
          {selectedName
            ? t('emptyPet', { name: selectedName })
            : t('emptyAll')}
          <p className="text-xs mt-2">{t('emptyHint')}</p>
        </div>
      ) : view === 'calendar' ? (
        <ScheduleCalendar items={visible} />
      ) : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-red-500">{t('sectionOverdue', { count: overdue.length })}</h2>
              <div className="space-y-2">{overdue.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
          {soon.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-600">{t('sectionSoon', { count: soon.length })}</h2>
              <div className="space-y-2">{soon.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
          {later.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">{t('sectionLater', { count: later.length })}</h2>
              <div className="space-y-2">{later.map(i => <Row key={i.id} i={i} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

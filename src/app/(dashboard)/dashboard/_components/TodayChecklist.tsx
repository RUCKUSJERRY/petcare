'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { todayKST } from '@/lib/utils'
import { logDailyRecord } from '@/lib/careActions'
import { computeTodayCare, type TodayCareCheckItem } from '@/lib/todayCare'

/**
 * 홈 '오늘의 돌봄 체크' — 매일 챙기는 핵심 4가지(밥·물·배변·산책)를 한 줄 체크리스트로.
 * 하루 습관 루프(재방문·기록 지속)를 명시적 '목표 달성'으로 만들어 리텐션을 유도한다.
 *
 * - 미완료 기록 항목은 탭하면 지금 시각으로 원탭 기록(QuickLogBar 와 동일 입력 경로).
 * - 산책은 walks 로 판정하며, 미완료면 산책 시작 화면으로 딥링크한다.
 * - today-log 캐시 키를 QuickLogBar 와 공유해, 한쪽에서 기록하면 즉시 함께 갱신된다.
 */
export function TodayChecklist() {
  const t = useTranslations('todayCare')
  const supabase = createClient()
  const qc = useQueryClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null
  const [busy, setBusy] = useState<string | null>(null)

  // QuickLogBar 와 동일한 키·조회 형태를 공유한다 — 같은 키에 서로 다른 select 를 쓰면
  // 먼저 마운트된 쪽의 데이터 형태가 캐시를 차지해 반대쪽이 깨진다. 형태를 맞춰,
  // 한쪽에서 원탭 기록하면(같은 키 무효화) 이 체크리스트도 즉시 함께 갱신되게 한다.
  const { data: todayLogs = [] } = useQuery({
    queryKey: ['today-log', selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('id, category, event_at')
        .eq('pet_id', selectedPetId!)
        .eq('event_on', todayKST())
        .order('event_at', { ascending: false })
      return (data ?? []) as { id: string; category: string; event_at: string | null }[]
    },
  })
  const todayCategories = todayLogs.map(r => r.category)

  const { data: walkedToday = false } = useQuery({
    queryKey: ['today-walk', selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const { count } = await supabase
        .from('walks')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', selectedPetId!)
        .gte('started_at', `${todayKST()}T00:00:00+09:00`)
      return (count ?? 0) > 0
    },
  })

  if (!pet || !selectedPetId) return null

  const status = computeTodayCare(todayCategories, walkedToday)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['today-log', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['record-feed', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    qc.invalidateQueries({ queryKey: ['weekly-report', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  const check = async (item: TodayCareCheckItem) => {
    if (!item.category || item.done || busy) return
    setBusy(item.key)
    const { error } = await logDailyRecord(supabase, selectedPetId, item.category)
    setBusy(null)
    if (!error) invalidate()
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden>✅</span>
          <span className="font-bold text-gray-900 text-sm">{t('title')}</span>
        </div>
        <span className={`text-xs font-bold ${status.allDone ? 'text-primary-600' : 'text-gray-400'}`}>
          {status.allDone ? t('allDone') : t('progress', { done: status.doneCount, total: status.total })}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {status.items.map(item => {
          const label = (
            <>
              <span className={`text-2xl leading-none ${item.done ? '' : 'grayscale opacity-40'}`} aria-hidden>
                {item.icon}
              </span>
              <span className={`text-xs font-semibold mt-1 ${item.done ? 'text-gray-900' : 'text-gray-400'}`}>
                {item.label}
              </span>
              <span className={`text-[11px] font-bold mt-0.5 ${item.done ? 'text-primary-600' : 'text-gray-300'}`}>
                {item.done ? '✓' : t('addShort')}
              </span>
            </>
          )
          const cls = `flex flex-col items-center rounded-xl border py-2.5 transition-colors ${
            item.done ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200 hover:border-primary-300'
          }`
          // 산책 미완료 → 산책 시작 화면으로. 그 외 기록 항목 미완료 → 원탭 기록.
          if (item.key === 'walk' && !item.done) {
            return (
              <Link key={item.key} href="/walks/track?autostart=1" className={cls} aria-label={t('addAria', { label: item.label })}>
                {label}
              </Link>
            )
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => check(item)}
              disabled={item.done || busy === item.key}
              aria-label={item.done ? undefined : t('addAria', { label: item.label })}
              className={`${cls} disabled:opacity-100`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'
import { completeCareToday } from '@/lib/careActions'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import type { CareAlert, Pet } from '@/types'

/**
 * 30일 이내/지난 건강 관리 일정 알림 (접종·심장사상충·구충 등).
 * 선택된 아이의 알림은 상단 요약 카드에 이미 표시되므로 여기서는 제외(중복 방지).
 * 각 항목은 "완료"로 바로 처리(오늘 시행 기록 추가 + 반복이면 다음 일정으로 갱신).
 */
export function VaccAlerts({ pets, alerts }: { pets: Pet[]; alerts: CareAlert[] }) {
  const { selectedPetId } = useSelectedPet()
  const t = useTranslations('vaccAlerts')
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const shown = selectedPetId
    ? alerts.filter(a => a.pet_id !== selectedPetId)
    : alerts

  if (shown.length === 0) return null

  const complete = async (v: CareAlert) => {
    if (!v.record_id) return
    setBusyId(v.record_id)
    const { error } = await completeCareToday(supabase, v)
    setBusyId(null)
    if (!error) router.refresh()
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden>🗓️</span>
        <span className="font-semibold text-amber-800 text-sm">
          {selectedPetId ? t('otherTitle') : t('allTitle')}
        </span>
      </div>
      {shown.slice(0, 4).map((v, i) => {
        const pet = pets.find(p => p.id === v.pet_id)
        const badge = ddayBadge(v.next_due_on)
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span aria-hidden>{careCategoryIcon(v.category)}</span>
            <span className="text-gray-700 truncate flex-1">
              {pet?.name} · {v.title}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
              {badge.text}
            </span>
            {v.record_id && (
              <button
                onClick={() => complete(v)}
                disabled={busyId === v.record_id}
                className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full bg-white text-amber-700 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
              >
                {busyId === v.record_id ? t('completing') : `✓ ${t('complete')}`}
              </button>
            )}
          </div>
        )
      })}
      {shown.length > 4 && (
        <p className="text-xs text-amber-600 pt-0.5">{t('moreCount', { count: shown.length - 4 })}</p>
      )}
      <Link href="/schedule" className="block text-xs text-amber-700 font-semibold pt-1">
        {t('viewAll')}
      </Link>
    </div>
  )
}

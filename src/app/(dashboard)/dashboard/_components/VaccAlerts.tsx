'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'
import Link from 'next/link'
import type { CareAlert, Pet } from '@/types'

/**
 * 30일 이내/지난 건강 관리 일정 알림 (접종·심장사상충·구충 등).
 * 선택된 아이의 알림은 상단 요약 카드에 이미 표시되므로 여기서는 제외(중복 방지).
 */
export function VaccAlerts({ pets, alerts }: { pets: Pet[]; alerts: CareAlert[] }) {
  const { selectedPetId } = useSelectedPet()

  const shown = selectedPetId
    ? alerts.filter(a => a.pet_id !== selectedPetId)
    : alerts

  if (shown.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden>🗓️</span>
        <span className="font-semibold text-amber-800 text-sm">
          {selectedPetId ? '다른 아이 일정' : '일정 알림'}
        </span>
      </div>
      {shown.slice(0, 4).map((v, i) => {
        const pet = pets.find(p => p.id === v.pet_id)
        const badge = ddayBadge(v.next_due_on)
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span aria-hidden>{careCategoryIcon(v.category)}</span>
            <span className="text-gray-700 truncate flex-1">
              {pet?.name} · {v.vaccine_name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
              {badge.text}
            </span>
          </div>
        )
      })}
      {shown.length > 4 && (
        <p className="text-xs text-amber-600 pt-0.5">외 {shown.length - 4}건 더</p>
      )}
      <Link href="/schedule" className="block text-xs text-amber-700 font-semibold pt-1">
        일정 전체 보기 →
      </Link>
    </div>
  )
}

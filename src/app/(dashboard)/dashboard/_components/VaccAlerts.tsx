'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import Link from 'next/link'
import type { Pet } from '@/types'

type VaccAlert = { pet_id: string; vaccine_name: string; next_due_on: string }

/**
 * 30일 이내/지난 접종 알림 위젯.
 * 선택된 아이의 알림은 상단 요약 카드에 이미 표시되므로 여기서는 제외(중복 방지).
 */
export function VaccAlerts({ pets, alerts }: { pets: Pet[]; alerts: VaccAlert[] }) {
  const { selectedPetId } = useSelectedPet()
  const today = new Date().toISOString().slice(0, 10)

  const shown = selectedPetId
    ? alerts.filter(a => a.pet_id !== selectedPetId)
    : alerts

  if (shown.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden>💉</span>
        <span className="font-semibold text-amber-800 text-sm">
          {selectedPetId ? '다른 아이 접종 알림' : '접종 알림'}
        </span>
      </div>
      {shown.slice(0, 3).map((v, i) => {
        const pet = pets.find(p => p.id === v.pet_id)
        const isOverdue = v.next_due_on < today
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span aria-hidden>{isOverdue ? '⚠️' : '📅'}</span>
            <span className="text-gray-700 truncate flex-1">
              {pet?.name} · {v.vaccine_name}
            </span>
            <span className={`text-xs font-medium shrink-0 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
              {v.next_due_on}{isOverdue ? ' (지남)' : ''}
            </span>
          </div>
        )
      })}
      {shown.length > 3 && (
        <p className="text-xs text-amber-600 pt-0.5">외 {shown.length - 3}건 더</p>
      )}
      <Link href="/pets" className="block text-xs text-amber-700 font-semibold pt-1">
        접종 기록 확인하기 →
      </Link>
    </div>
  )
}

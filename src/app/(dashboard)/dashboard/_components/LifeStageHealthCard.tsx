'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { calcPetAge, stageLabel, todayKST } from '@/lib/utils'
import { healthChecklistFor } from '@/lib/healthChecklist'

/** 날짜 문자열(YYYY-MM-DD)을 '에포크 이후 일수'로 — 매일 다른 항목을 결정적으로 고르기 위함 */
function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * 홈 '오늘의 건강 포인트' — 선택한 아이의 종·생애단계에 맞는 건강 체크리스트에서
 * 하루 한 항목을 골라 보여준다. 이미 있는 큐레이션 정보(healthChecklist)를 홈으로 끌어올려
 * 발견성을 높이고(정보 고도화), 매일 바뀌어 재방문 이유를 더한다. 전체는 /health 로 연결.
 */
export function LifeStageHealthCard() {
  const t = useTranslations('dashboard')
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null
  if (!pet) return null

  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
  const checklist = healthChecklistFor(pet.species, stageLabel(age))
  if (!checklist.items.length) return null

  // 매일 다른 항목(생애단계 안에서 순환). 아이·날짜가 같으면 항상 같은 항목 → 안정적.
  const item = checklist.items[dayNumber(todayKST()) % checklist.items.length]

  return (
    <Link
      href="/health"
      className="card block hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500">{t('healthPointTitle')}</h2>
        <span className="text-xs text-gray-400 font-medium">{t('healthPointMore')} ›</span>
      </div>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0" aria-hidden>{item.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
        </div>
      </div>
    </Link>
  )
}

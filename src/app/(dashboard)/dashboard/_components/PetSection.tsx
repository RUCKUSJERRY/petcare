'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import Link from 'next/link'
import type { CareAlert, Pet } from '@/types'
import { SelectedPetSummary } from './SelectedPetSummary'

/**
 * 홈의 펫 영역.
 * - 헤더에서 아이를 선택하면: 요약 카드 + "다른 아이들" 목록
 * - 선택이 없으면: "우리 아이들" 전체 목록
 */
export function PetSection({
  pets,
  vaccAlerts,
}: {
  pets: Pet[]
  vaccAlerts: CareAlert[]
}) {
  const { selectedPetId } = useSelectedPet()

  if (pets.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">🐶</div>
        <p className="text-gray-500 text-sm">아직 등록된 반려동물이 없어요</p>
        <Link href="/pets/new" className="btn-primary inline-block mt-4 text-sm">
          첫 아이 등록하기
        </Link>
      </div>
    )
  }

  const hasSelection = selectedPetId != null && pets.some(p => p.id === selectedPetId)
  const listPets = hasSelection ? pets.filter(p => p.id !== selectedPetId) : pets

  return (
    <div className="space-y-3">
      {/* 선택된 아이 요약 카드 */}
      <SelectedPetSummary pets={pets} vaccAlerts={vaccAlerts} />

      {/* 나머지 아이 목록 */}
      {listPets.length > 0 && (
        <div className="space-y-2">
          {hasSelection && (
            <h2 className="text-sm font-semibold text-gray-500 pt-1">다른 아이들</h2>
          )}
          {listPets.map(pet => {
            const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <div className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {pet.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.photo_url} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                    ) : (pet.species === 'cat' ? '🐱' : '🐶')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{pet.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                        {age.lifeStage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {pet.breed?.name_ko} · {age.displayText} · {pet.gender}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
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
  // 선택된 아이가 있을 때 "다른 아이들" 목록은 기본 접힘 (영역 차지 최소화)
  const [othersOpen, setOthersOpen] = useState(false)

  if (pets.length === 0) {
    return (
      <div className="space-y-4">
        {/* 환영 히어로 */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-white text-center">
          <div className="text-5xl mb-3">🐶🐱</div>
          <h2 className="text-lg font-bold">우리 아이를 등록해볼까요?</h2>
          <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
            아이를 등록하면 견종·나이에 꼭 맞는<br />음식·건강·활동 정보를 받아볼 수 있어요.
          </p>
          <Link
            href="/pets/new"
            className="inline-block mt-4 bg-white text-primary-700 font-bold text-sm rounded-xl px-5 py-2.5 hover:bg-white/90 transition-colors"
          >
            + 첫 아이 등록하기
          </Link>
        </div>

        {/* 기능 미리보기 */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { emoji: '🥩', label: '음식 안전' },
            { emoji: '🗓️', label: '건강 일정' },
            { emoji: '💬', label: '커뮤니티' },
          ].map(f => (
            <div key={f.label} className="card text-center py-4">
              <div className="text-2xl mb-1">{f.emoji}</div>
              <div className="text-xs text-gray-500 font-medium">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const hasSelection = selectedPetId != null && pets.some(p => p.id === selectedPetId)
  const listPets = hasSelection ? pets.filter(p => p.id !== selectedPetId) : pets

  return (
    <div className="space-y-3">
      {/* 선택된 아이 요약 카드 */}
      <SelectedPetSummary pets={pets} vaccAlerts={vaccAlerts} />

      {/* 나머지 아이 목록 — 선택된 아이가 있으면 접어두기 (공간 절약) */}
      {listPets.length > 0 && (
        <div className="space-y-2">
          {hasSelection && (
            <button
              type="button"
              onClick={() => setOthersOpen(o => !o)}
              className="w-full flex items-center justify-between pt-1 text-sm font-semibold text-gray-500"
              aria-expanded={othersOpen}
            >
              <span>다른 아이들 {listPets.length}마리</span>
              <span className="text-gray-400">{othersOpen ? '접기 ▲' : '펼치기 ▼'}</span>
            </button>
          )}
          {(!hasSelection || othersOpen) && listPets.map(pet => {
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

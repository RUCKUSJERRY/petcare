'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { CareAlert, Pet } from '@/types'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { SelectedPetSummary } from './SelectedPetSummary'
import { VaccAlerts } from './VaccAlerts'
import { WeightInsightCard } from './WeightInsightCard'

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
  const { selectedPetId, hydrated } = useSelectedPet()
  const t = useTranslations('petSection')
  // 선택된 아이가 있을 때 "다른 아이들" 목록은 기본 접힘 (영역 차지 최소화)
  const [othersOpen, setOthersOpen] = useState(false)

  if (pets.length === 0) {
    const features = [
      { emoji: '🥩', key: 'featFood' as const },
      { emoji: '🗓️', key: 'featSchedule' as const },
      { emoji: '💬', key: 'featCommunity' as const },
    ]
    return (
      <div className="space-y-4">
        {/* 환영 히어로 */}
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-6 text-white text-center">
          <div className="text-5xl mb-3">🐶🐱</div>
          <h2 className="text-lg font-bold">{t('heroTitle')}</h2>
          <p className="text-sm text-white/85 mt-1.5 leading-relaxed">
            {t.rich('heroDesc', { br: () => <br /> })}
          </p>
          <Link
            href="/pets/new"
            className="inline-block mt-4 bg-white text-primary-700 font-bold text-sm rounded-xl px-5 py-2.5 hover:bg-white/90 transition-colors"
          >
            {t('registerFirst')}
          </Link>
        </div>

        {/* 기능 미리보기 */}
        <div className="grid grid-cols-3 gap-2">
          {features.map(f => (
            <div key={f.key} className="card text-center py-4">
              <div className="text-2xl mb-1">{f.emoji}</div>
              <div className="text-xs text-gray-500 font-medium">{t(f.key)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // localStorage 복원 전에는 선택 여부가 미확정 → "선택 없음" 화면을 먼저 그렸다가 요약카드로
  // 뒤집히는 깜빡임이 난다. 복원 전까지는 자리만 잡는 스켈레톤을 보여 뒤집힘을 없앤다.
  if (!hydrated) {
    return <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" aria-hidden />
  }

  const hasSelection = selectedPetId != null && pets.some(p => p.id === selectedPetId)
  const listPets = hasSelection ? pets.filter(p => p.id !== selectedPetId) : pets
  // 접힌 '다른 아이들' 안에 숨는 건강 알림 건수 — 접힌 헤더에 배지로 노출(놓치지 않도록)
  const othersAlertCount = hasSelection
    ? vaccAlerts.filter(a => a.pet_id !== selectedPetId).length
    : 0

  return (
    <div className="space-y-3">
      {/* 선택된 아이 요약 카드 */}
      <SelectedPetSummary pets={pets} vaccAlerts={vaccAlerts} />

      {/* 선택된 아이의 체중 추세 인사이트 (로그 2건 이상일 때만) */}
      {hasSelection && selectedPetId && <WeightInsightCard petId={selectedPetId} />}

      {hasSelection ? (
        // 선택된 아이가 있으면: 다른 아이들 목록 + 다른 아이 건강 일정을 함께 접기/펼치기
        listPets.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setOthersOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 pt-1 text-sm font-semibold text-gray-500"
              aria-expanded={othersOpen}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{t('othersCount', { count: listPets.length })}</span>
                {/* 접혀 있을 때만: 그 안에 숨은 건강 알림 개수를 배지로 알린다 */}
                {!othersOpen && othersAlertCount > 0 && (
                  <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {t('alertBadge', { count: othersAlertCount })}
                  </span>
                )}
              </span>
              <span className="text-gray-400 shrink-0">{othersOpen ? t('collapse') : t('expand')}</span>
            </button>
            {othersOpen && (
              <div className="space-y-2">
                {listPets.map(pet => <PetRow key={pet.id} pet={pet} />)}
                {/* 다른 아이 건강 일정도 함께 노출 (접으면 같이 숨김) */}
                <VaccAlerts pets={pets} alerts={vaccAlerts} />
              </div>
            )}
          </div>
        )
      ) : (
        // 선택이 없으면: 전체 아이 목록 + 전체 건강 일정 알림
        <>
          {/* 다견인데 선택이 없으면, 요약 카드가 칩 탭 뒤에 숨어 있음을 안내(발견성 개선) */}
          {pets.length > 1 && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 text-center">
              {t('selectHint')}
            </p>
          )}
          {listPets.length > 0 && (
            <div className="space-y-2">
              {listPets.map(pet => <PetRow key={pet.id} pet={pet} />)}
            </div>
          )}
          <VaccAlerts pets={pets} alerts={vaccAlerts} />
        </>
      )}
    </div>
  )
}

/** 펫 목록 행 (요약 카드 아래 목록용) */
function PetRow({ pet }: { pet: Pet }) {
  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
  return (
    <Link href={`/pets/${pet.id}`}>
      <div className="card flex items-center gap-4 hover:shadow-md transition-shadow">
        <PetAvatar photoUrl={pet.photo_url} species={pet.species} name={pet.name}
          className="w-14 h-14 bg-primary-100" emojiClassName="text-2xl" />
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
}

'use client'

import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, guideMatchScore, lifeStageColor, stageLabel } from '@/lib/utils'
import { healthChecklistFor } from '@/lib/healthChecklist'
import { useQuery } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { PetScopeToggle } from '@/components/ui/PetScopeToggle'
import { GuideSearchInput } from '@/components/ui/GuideSearchInput'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import { fetchHealthGuides } from '../_actions/guides'
import { useState } from 'react'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { HealthGuide, Pet } from '@/types'

/** 건강 가이드가 키워드에 걸리는지 — 분류·제목·설명 텍스트를 검색한다. */
function healthGuideMatches(g: HealthGuide, q: string): boolean {
  if (!q) return true
  return `${g.category} ${g.title} ${g.description}`.toLowerCase().includes(q)
}

export default function HealthPage() {
  const t = useTranslations('healthGuide')
  const { selectedPetId } = useSelectedPet()
  const [query, setQuery] = useState('')
  const nq = query.trim().toLowerCase()

  const { data: petsAll, isLoading: petsLoading } = useMyPets()

  const { data: allGuides, isLoading: guidesLoading } = useQuery({
    queryKey: ['health-guides'],
    queryFn: () => fetchHealthGuides(), // 서버 캐시(1시간) 공유
    staleTime: 60 * 60 * 1000,
  })

  const isLoading = petsLoading || guidesLoading

  // 보기 범위: 기본은 헤더에서 고른 아이. 여러 아이를 키우면 '전체'로 전환해 모든 아이의 건강
  // 정보를 함께 볼 수 있다(비용·일정 화면과 통일). 헤더 아이 칩은 '해제'가 없어(홈이 빈 화면처럼
  // 보이던 문제로 제거됨), 이 토글이 없으면 다견 보호자가 '전체 보기'에 도달할 방법이 없었다.
  const [showAll, setShowAll] = useState(false)
  const multiPet = (petsAll?.length ?? 0) >= 2
  const effectivePetId = showAll ? null : selectedPetId
  const pets = effectivePetId
    ? (petsAll ?? []).filter(p => p.id === effectivePetId)
    : (petsAll ?? [])
  const activePet = selectedPetId ? (petsAll ?? []).find(p => p.id === selectedPetId) : null

  const petGuides = pets.map((pet: Pet) => {
    const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
    const size = pet.breed?.size_category ?? null

    const ageMatched = (allGuides ?? []).filter(g =>
      g.species === pet.species &&
      g.age_month_min <= age.months && g.age_month_max >= age.months
    )

    let guides = ageMatched
      .filter(g => !g.breed_id || g.breed_id === pet.breed_id)
      .sort((a, b) => guideMatchScore(b, pet.breed_id ?? '', size) - guideMatchScore(a, pet.breed_id ?? '', size))

    if (guides.length === 0) {
      guides = ageMatched.filter(g => !g.breed_id && !g.size_category)
    }

    // 키워드 검색: 체크리스트 항목과 맞춤 가이드를 함께 좁힌다(정보를 다시 찾는 이유 → 체류).
    const checklist = healthChecklistFor(pet.species, stageLabel(age))
    const items = nq
      ? checklist.items.filter(it => `${it.title} ${it.detail}`.toLowerCase().includes(nq))
      : checklist.items
    const filteredGuides = nq ? guides.filter(g => healthGuideMatches(g, nq)) : guides

    return { pet, age, checklist: { ...checklist, items }, guides: filteredGuides }
  })

  // 검색 중 어떤 아이에도 걸리는 내용이 없으면 전체 빈 결과로 안내한다.
  const anyMatch = petGuides.some(pg => pg.checklist.items.length > 0 || pg.guides.length > 0)

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} />
        {multiPet && activePet ? (
          <PetScopeToggle
            showAll={showAll}
            onChange={setShowAll}
            petName={activePet.name}
            petSpecies={activePet.species}
            petPhotoUrl={activePet.photo_url}
          />
        ) : activePet ? (
          <span className="text-sm text-primary-600 font-medium shrink-0">
            {activePet.species === 'cat' ? '🐱' : '🐶'} {t('petBasis', { name: activePet.name })}
          </span>
        ) : null}
      </div>

      <SectionTabs section="info" />

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">
        {t('disclaimer')}
      </div>

      {petGuides.length > 0 && (
        <GuideSearchInput value={query} onChange={setQuery} placeholder={t('searchPlaceholder')} />
      )}

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : petGuides.length === 0 ? (
        <EmptyState
          icon="🐾"
          title={t('noPets')}
          action={
            <Link href="/pets/new" className="btn-primary inline-block text-sm px-4 py-2">
              {t('registerPet')}
            </Link>
          }
        />
      ) : nq && !anyMatch ? (
        <EmptyState
          icon="🔎"
          title={t('searchEmpty')}
          action={
            <button onClick={() => setQuery('')} className="btn-primary text-sm py-1.5 px-4">
              {t('searchReset')}
            </button>
          }
        />
      ) : (
        petGuides
          // 검색 중이면 걸리는 내용이 있는 아이만 보여준다(빈 블록 방지).
          .filter(pg => !nq || pg.checklist.items.length > 0 || pg.guides.length > 0)
          .map(({ pet, age, checklist, guides }) => (
          <div key={pet.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pet.name}</span>
              <span className="text-sm text-gray-400">{age.displayText}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(stageLabel(age))}`}>
                {stageLabel(age)}
              </span>
            </div>

            {/* 생애주기별 건강 체크리스트 — 이 시기에 챙기면 좋은 예방·관찰 포인트(정적 큐레이션).
                검색 중에는 걸린 항목만 남으며, 없으면 카드를 숨긴다(위에서 필터한 checklist 사용). */}
            {checklist.items.length > 0 && (
              <div className="card space-y-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden>✅</span>
                  <span className="font-bold text-sm text-gray-900">{t('checklistTitle')}</span>
                </div>
                {!nq && checklist.summary && <p className="text-xs text-gray-500">{checklist.summary}</p>}
                <ul className="space-y-2">
                  {checklist.items.map((it, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="text-lg leading-none shrink-0" aria-hidden>{it.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{it.title}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{it.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {guides.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 pt-1">{t('guidesTitle')}</p>
            )}

            {/* 검색 중(nq)일 땐 '나이 가이드 없음' 안내를 띄우지 않는다 — 필터 결과 0을 '가이드 없음'으로
                오인시키지 않도록. 평상시에만 나이대 가이드 부재를 안내한다. */}
            {guides.length === 0 ? (
              !nq && (
                <div className="card text-sm text-gray-400 py-4 text-center">
                  {t('noGuides')}
                </div>
              )
            ) : (
              guides.map((guide: HealthGuide) => (
                <div key={guide.id} className="card space-y-1 border-l-4 border-primary-400" style={{ borderRadius: '0 12px 12px 0' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                      {guide.category}
                    </span>
                    <span className="font-semibold text-sm text-gray-900">{guide.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{guide.description}</p>
                </div>
              ))
            )}
          </div>
        ))
      )}

      {/* 하단 고정 제휴 배너(건강용품·영양제) — 아직 아이를 등록하지 않아 '등록' 안내만 뜨는
          화면에서는 광고를 띄우지 않는다(빈 상태 CTA를 가리지 않도록). */}
      {petGuides.length > 0 && (
        <StickyAffiliateBanner species={pets[0]?.species ?? 'dog'} context="health" />
      )}
    </div>
  )
}

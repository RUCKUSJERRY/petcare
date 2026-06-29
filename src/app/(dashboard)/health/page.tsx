'use client'

import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, guideMatchScore, lifeStageColor } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import { fetchHealthGuides } from '../_actions/guides'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import type { HealthGuide, Pet } from '@/types'

export default function HealthPage() {
  const t = useTranslations('healthGuide')
  const { selectedPetId } = useSelectedPet()

  const { data: petsAll, isLoading: petsLoading } = useMyPets()

  const { data: allGuides, isLoading: guidesLoading } = useQuery({
    queryKey: ['health-guides'],
    queryFn: () => fetchHealthGuides(), // 서버 캐시(1시간) 공유
    staleTime: 60 * 60 * 1000,
  })

  const isLoading = petsLoading || guidesLoading

  const pets = selectedPetId
    ? (petsAll ?? []).filter(p => p.id === selectedPetId)
    : (petsAll ?? [])

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

    return { pet, age, guides }
  })

  return (
    <div className="px-4 py-6 space-y-6">
      <PageHeader title={t('title')} />

      <SectionTabs section="info" />

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">
        {t('disclaimer')}
      </div>

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : petGuides.length === 0 ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-gray-400">{t('noPets')}</p>
          <Link href="/pets/new" className="btn-primary inline-block text-sm px-4 py-2">
            {t('registerPet')}
          </Link>
        </div>
      ) : (
        petGuides.map(({ pet, age, guides }) => (
          <div key={pet.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pet.name}</span>
              <span className="text-sm text-gray-400">{age.displayText}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                {age.lifeStage}
              </span>
            </div>

            {guides.length === 0 ? (
              <div className="card text-sm text-gray-400 py-4 text-center">
                {t('noGuides')}
              </div>
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

      {/* 하단 고정 제휴 배너(건강용품·영양제) */}
      <StickyAffiliateBanner species={pets[0]?.species ?? 'dog'} context="health" />
    </div>
  )
}

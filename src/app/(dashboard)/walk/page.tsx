'use client'

import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor, stageLabel, pickBestPerActivityType } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import { fetchWalkGuides } from '../_actions/guides'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Pet } from '@/types'

// activity_type 표시 메타
const ACTIVITY_META: Record<string, { icon: string; label: string; desc: string }> = {
  '산책':     { icon: '🦮', label: '산책',     desc: '야외 활동 · 일일 권장량' },
  '실내놀이': { icon: '🎾', label: '실내놀이', desc: '집 안에서 함께하는 놀이' },
  '인지훈련': { icon: '🧠', label: '인지훈련', desc: '노즈워크 · 트릭 · 퍼즐' },
  '사냥놀이': { icon: '🪄', label: '사냥놀이', desc: '낚싯대 · 레이저 · 터널' },
  '실내탐험': { icon: '🏠', label: '실내탐험', desc: '캣타워 · 박스 · 수직공간' },
}

// 강아지/고양이별 표시 순서
const ACTIVITY_ORDER: Record<string, string[]> = {
  dog: ['산책', '실내놀이', '인지훈련'],
  cat: ['사냥놀이', '실내탐험', '인지훈련'],
}

const intensityColor = (i: string) => ({
  '가벼움': 'bg-blue-100 text-blue-700',
  '보통':   'bg-green-100 text-green-700',
  '활발':   'bg-orange-100 text-orange-700',
}[i] ?? 'bg-gray-100 text-gray-700')

export default function WalkPage() {
  const t = useTranslations('walkGuide')
  const { selectedPetId } = useSelectedPet()

  const { data: petsAll, isLoading: petsLoading } = useMyPets()

  const { data: allGuides, isLoading: guidesLoading } = useQuery({
    queryKey: ['walk-guides'],
    queryFn: () => fetchWalkGuides(), // 서버 캐시(1시간) 공유
    staleTime: 60 * 60 * 1000,
  })

  const isLoading = petsLoading || guidesLoading

  const pets = selectedPetId
    ? (petsAll ?? []).filter(p => p.id === selectedPetId)
    : (petsAll ?? [])
  // 헤더 칩으로 특정 아이를 고르면 그 아이 기준으로 필터됨을 상단 라벨로 알린다(음식·일정 화면과 통일).
  const activePet = selectedPetId ? (petsAll ?? []).find(p => p.id === selectedPetId) : null

  const petGuides = pets.map((pet: Pet) => {
    const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
    const size = pet.breed?.size_category ?? null

    const candidates = (allGuides ?? []).filter(
      g => g.species === pet.species &&
        g.age_month_min <= age.months && g.age_month_max >= age.months
    )

    // activity_type 별로 가장 적합한 가이드 1건씩 추출
    const byType = pickBestPerActivityType(candidates, pet.breed_id ?? '', size)

    // 종에 맞는 순서로 정렬
    const orderedTypes = (ACTIVITY_ORDER[pet.species] ?? []).filter(t => byType.has(t))

    return { pet, age, byType, orderedTypes }
  })

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} />
        {activePet && (
          <span className="text-sm text-primary-600 font-medium shrink-0">
            {activePet.species === 'cat' ? '🐱' : '🐶'} {t('petBasis', { name: activePet.name })}
          </span>
        )}
      </div>

      <SectionTabs section="info" />

      {isLoading ? (
        <CardSkeletonList count={3} />
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
      ) : (
        petGuides.map(({ pet, age, byType, orderedTypes }) => (
          <div key={pet.id} className="space-y-3">
            {/* 펫 헤더 */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pet.name}</span>
              <span className="text-sm text-gray-400">{age.displayText}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(stageLabel(age))}`}>
                {stageLabel(age)}
              </span>
            </div>

            {orderedTypes.length === 0 ? (
              <div className="card text-sm text-gray-400 py-4 text-center">
                {t('noGuides')}
              </div>
            ) : (
              orderedTypes.map(type => {
                const guide = byType.get(type)!
                const meta = ACTIVITY_META[type] ?? { icon: '🐾', label: type, desc: '' }
                return (
                  <div key={type} className="card space-y-3">
                    {/* 활동 타입 헤더 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{meta.icon}</span>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{meta.label}</div>
                        <div className="text-xs text-gray-400">{meta.desc}</div>
                      </div>
                    </div>

                    {/* 수치 뱃지 */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-center bg-primary-50 rounded-xl px-3 py-2.5">
                        <div className="text-2xl font-bold text-primary-600">{guide.daily_minutes}</div>
                        <div className="text-xs text-primary-400 mt-0.5">{t('dailyMinutes')}</div>
                      </div>
                      <div className="flex-1 text-center bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className={`text-sm font-semibold px-2 py-1 rounded-full inline-block ${intensityColor(guide.intensity)}`}>
                          {guide.intensity}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{t('intensity')}</div>
                      </div>
                    </div>

                    {/* 팁 */}
                    {guide.tips && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                        {guide.tips}
                      </p>
                    )}

                    {/* 산책 활동은 실제 GPS 산책 기록 화면으로 바로 연결 — 가이드(권장 분)를
                        읽은 뒤 다른 탭을 찾아 헤매지 않고 그 자리에서 기록을 시작한다. */}
                    {type === '산책' && (
                      <Link
                        href="/walks/track"
                        className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-1.5"
                      >
                        <span aria-hidden>🦮</span> {t('startTrack')}
                      </Link>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ))
      )}

      {/* 하단 고정 제휴 배너(산책용품) */}
      <StickyAffiliateBanner species={pets[0]?.species ?? 'dog'} context="walk" />
    </div>
  )
}

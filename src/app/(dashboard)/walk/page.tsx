'use client'

import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor, stageLabel, pickBestPerActivityType } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { GuideSearchInput } from '@/components/ui/GuideSearchInput'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import { fetchWalkGuides } from '../_actions/guides'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Pet } from '@/types'

// activity_type 표시 아이콘 (라벨·설명은 walkGuide.activity 메시지에서 — i18n 단일 출처)
const ACTIVITY_ICON: Record<string, string> = {
  '산책': '🦮', '실내놀이': '🎾', '인지훈련': '🧠', '사냥놀이': '🪄', '실내탐험': '🏠',
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
  // 활동 라벨·설명은 메시지에서 (미정의 타입은 타입명/빈 설명으로 안전 폴백)
  const activityLabel = (type: string) => t.has(`activity.${type}.label`) ? t(`activity.${type}.label`) : type
  const activityDesc = (type: string) => t.has(`activity.${type}.desc`) ? t(`activity.${type}.desc`) : ''
  const { selectedPetId } = useSelectedPet()
  const [query, setQuery] = useState('')
  const nq = query.trim().toLowerCase()

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
    let orderedTypes = (ACTIVITY_ORDER[pet.species] ?? []).filter(t => byType.has(t))

    // 키워드 검색: 활동명·설명·타입·팁 텍스트로 좁힌다(원하는 활동을 바로 찾도록).
    if (nq) {
      orderedTypes = orderedTypes.filter(type => {
        const guide = byType.get(type)
        return `${activityLabel(type)} ${activityDesc(type)} ${type} ${guide?.tips ?? ''}`
          .toLowerCase().includes(nq)
      })
    }

    return { pet, age, byType, orderedTypes }
  })

  // 검색 중 어떤 아이에도 걸리는 활동이 없으면 전체 빈 결과로 안내한다.
  const anyMatch = petGuides.some(pg => pg.orderedTypes.length > 0)

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

      {/* '활동 가이드'(권장량·팁)와 실제 'GPS 산책 기록'을 사용자가 헷갈리지 않도록 명시적으로
          연결한다 — 이 화면은 가이드, 내 산책 이력·통계는 산책 기록 화면. */}
      <Link
        href="/walks"
        className="flex items-center justify-between gap-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl px-3.5 py-2.5 hover:bg-primary-100 transition-colors"
      >
        <span className="flex items-center gap-1.5"><span aria-hidden>🦮</span>{t('recordsLink')}</span>
        <span aria-hidden>›</span>
      </Link>

      {petGuides.length > 0 && (
        <GuideSearchInput value={query} onChange={setQuery} placeholder={t('searchPlaceholder')} />
      )}

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
          // 검색 중이면 걸리는 활동이 있는 아이만 보여준다(빈 블록 방지).
          .filter(pg => !nq || pg.orderedTypes.length > 0)
          .map(({ pet, age, byType, orderedTypes }) => (
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
                return (
                  <div key={type} className="card space-y-3">
                    {/* 활동 타입 헤더 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{ACTIVITY_ICON[type] ?? '🐾'}</span>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{activityLabel(type)}</div>
                        <div className="text-xs text-gray-400">{activityDesc(type)}</div>
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

      {/* 하단 고정 제휴 배너(산책용품) — 아직 아이를 등록하지 않아 '등록' 안내만 뜨는 화면에서는
          광고를 띄우지 않는다(빈 상태 CTA를 가리지 않도록). */}
      {petGuides.length > 0 && (
        <StickyAffiliateBanner species={pets[0]?.species ?? 'dog'} context="walk" />
      )}
    </div>
  )
}

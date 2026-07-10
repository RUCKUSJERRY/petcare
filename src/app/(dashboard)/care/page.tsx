'use client'

import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import { careGuidesForSpecies, type CareGuideStage, type CareGuideTopic } from '@/lib/careGuideData'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import type { PetAge, Species } from '@/types'

/** calcPetAge의 lifeStage → 가이드 단계로 매핑 */
function toStage(lifeStage: PetAge['lifeStage']): CareGuideStage {
  if (lifeStage === '퍼피' || lifeStage === '키튼') return '퍼피·키튼'
  if (lifeStage === '시니어') return '시니어'
  return '성견·성묘'
}

function GuideCard({
  guide,
  stage,
  size,
}: {
  guide: CareGuideTopic
  stage: CareGuideStage
  size: '소형' | '중형' | '대형' | null
}) {
  const t = useTranslations('careGuide')
  const [open, setOpen] = useState(false)
  // 해당 나이단계(또는 공통) 노트만, 크기 제약이 있으면 일치할 때만
  const notes = guide.notes.filter(
    n => (n.stage === stage || n.stage === '공통') && (!n.size || n.size === size)
  )
  // 펼쳤을 때 실제로 더 보여줄 내용(방법·팁)이 있을 때만 펼치기 버튼을 노출한다.
  // (노트는 항상 보이므로, 펼칠 게 없는데도 '펼치기'가 있으면 눌러도 반응이 없어 오해를 준다.)
  const hasMore = (guide.steps?.length ?? 0) > 0 || (guide.tips?.length ?? 0) > 0

  const Header = (
    <>
      <span className="text-2xl shrink-0" aria-hidden>{guide.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900">{guide.topic}</div>
        <div className="text-xs text-primary-600 font-medium mt-0.5">🔁 {guide.frequency}</div>
      </div>
      {hasMore && <span className="text-gray-400 text-sm shrink-0">{open ? t('collapse') : t('expand')}</span>}
    </>
  )

  return (
    <div className="card space-y-2 border-l-4 border-primary-400" style={{ borderRadius: '0 12px 12px 0' }}>
      {hasMore ? (
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 text-left">
          {Header}
        </button>
      ) : (
        <div className="w-full flex items-center gap-2.5">{Header}</div>
      )}

      {notes.length > 0 && (
        <div className="space-y-1.5">
          {notes.map((n, i) => (
            <p key={i} className="text-sm text-gray-600 leading-relaxed">
              {n.stage !== '공통' && (
                <span className="text-xs font-semibold text-gray-400 mr-1">[{n.stage}]</span>
              )}
              {n.text}
            </p>
          ))}
        </div>
      )}

      {open && hasMore && (
        <div className="space-y-3 pt-1">
          {guide.steps && guide.steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">{t('methodLabel')}</p>
              <ol className="space-y-1 text-sm text-gray-600">
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary-500 font-semibold shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {guide.tips && guide.tips.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-2.5 space-y-1">
              {guide.tips.map((t, i) => (
                <p key={i} className="text-xs text-amber-700">💡 {t}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CarePage() {
  const t = useTranslations('careGuide')
  const { selectedPetId } = useSelectedPet()
  const { data: petsAll, isLoading } = useMyPets()

  const pets = selectedPetId
    ? (petsAll ?? []).filter(p => p.id === selectedPetId)
    : (petsAll ?? [])

  // 선택된 아이가 없으면 강아지 기준 전체 표시 (등록 전에도 둘러볼 수 있게)
  const species: Species = pets[0]?.species ?? 'dog'
  const pet = pets[0]
  const age = pet ? calcPetAge(pet.birth_year, pet.birth_month, pet.species) : null
  const stage: CareGuideStage = age ? toStage(age.lifeStage) : '성견·성묘'
  const size = pet?.breed?.size_category ?? null

  const guides = careGuidesForSpecies(species)

  return (
    <div className="px-4 py-6 space-y-4">
      <PageHeader title={t('title')} fallbackHref="/info" />
      {/* 정보 섹션 형제(음식·건강·활동·생활관리) 간 이동 — 건강 가이드와 동일한 탭 스트립으로 일관화 */}
      <SectionTabs section="info" />

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">
        {t('disclaimer')}
      </div>

      {pet && age && (
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{pet.name}</span>
          <span className="text-sm text-gray-400">{pet.breed?.name_ko} · {age.displayText}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
            {age.lifeStage}
          </span>
        </div>
      )}

      {isLoading ? (
        <CardSkeletonList count={4} />
      ) : (
        <div className="space-y-3">
          {guides.map(g => (
            <GuideCard key={g.id} guide={g} stage={stage} size={size} />
          ))}
        </div>
      )}

      {!pet && !isLoading && (
        <div className="card text-center py-6 space-y-2">
          <p className="text-sm text-gray-400">{t('emptyHint')}</p>
          <Link href="/pets/new" className="btn-primary inline-block text-sm px-4 py-2">{t('registerPet')}</Link>
        </div>
      )}

      {/* 하단 고정 제휴 배너(생활관리 용품) */}
      <StickyAffiliateBanner species={species} context="care" />
    </div>
  )
}

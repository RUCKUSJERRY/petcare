'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, lifeStageColor, pickBestPerActivityType } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { fetchWalkGuides } from '../_actions/guides'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import type { Pet, WalkGuide } from '@/types'

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
  const { selectedPetId } = useSelectedPet()
  const supabase = createClient()

  const { data: petsAll, isLoading: petsLoading } = useQuery({
    queryKey: ['my-pets-full'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as Pet[]
      const { data } = await supabase
        .from('pets')
        .select('*, breed:breeds(*)')
        .eq('user_id', user.id)
        .order('created_at')
      return (data ?? []) as Pet[]
    },
  })

  const { data: allGuides, isLoading: guidesLoading } = useQuery({
    queryKey: ['walk-guides'],
    queryFn: () => fetchWalkGuides(), // 서버 캐시(1시간) 공유
    staleTime: 60 * 60 * 1000,
  })

  const isLoading = petsLoading || guidesLoading

  const pets = selectedPetId
    ? (petsAll ?? []).filter(p => p.id === selectedPetId)
    : (petsAll ?? [])

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
      <PageHeader title="활동 가이드" />

      {isLoading ? (
        <CardSkeletonList count={3} />
      ) : petGuides.length === 0 ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-gray-400">반려동물을 먼저 등록해주세요</p>
          <Link href="/pets/new" className="btn-primary inline-block text-sm px-4 py-2">
            반려동물 등록하기
          </Link>
        </div>
      ) : (
        petGuides.map(({ pet, age, byType, orderedTypes }) => (
          <div key={pet.id} className="space-y-3">
            {/* 펫 헤더 */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pet.name}</span>
              <span className="text-sm text-gray-400">{age.displayText}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                {age.lifeStage}
              </span>
            </div>

            {orderedTypes.length === 0 ? (
              <div className="card text-sm text-gray-400 py-4 text-center">
                현재 나이에 해당하는 가이드가 없어요
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
                        <div className="text-xs text-primary-400 mt-0.5">일일 권장 분</div>
                      </div>
                      <div className="flex-1 text-center bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className={`text-sm font-semibold px-2 py-1 rounded-full inline-block ${intensityColor(guide.intensity)}`}>
                          {guide.intensity}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">강도</div>
                      </div>
                    </div>

                    {/* 팁 */}
                    {guide.tips && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                        {guide.tips}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ))
      )}
    </div>
  )
}

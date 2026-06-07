import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge, guideMatchScore } from '@/lib/utils'
import { getHealthGuides } from '@/lib/staticData'
import type { Pet } from '@/types'

export default async function HealthPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: pets }, allGuides] = await Promise.all([
    supabase.from('pets').select('*, breed:breeds(*)').eq('user_id', user!.id),
    getHealthGuides(), // 캐시된 전체 가이드 (DB 왕복 없음)
  ])

  // 각 반려동물의 현재 나이에 맞는 건강 가이드 (메모리 필터)
  const petGuides = (pets ?? []).map((pet: Pet) => {
    const age = calcPetAge(pet.birth_year, pet.birth_month)
    const size = pet.breed?.size_category ?? null
    const guides = allGuides
      .filter(g => g.age_month_min <= age.months && g.age_month_max >= age.months)
      .filter(g => guideMatchScore(g, pet.breed_id, size) > 0) // 내 아이에 해당하는 것만
      // 견종별 > 크기별 > 공통 순으로 정렬
      .sort((a, b) => guideMatchScore(b, pet.breed_id, size) - guideMatchScore(a, pet.breed_id, size))
    return { pet, age, guides }
  })

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">건강 가이드</h1>

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">
        ⓘ 일반적인 참고 정보예요. 우리 아이의 정확한 건강 상태와 진단은 수의사와 상담하세요.
      </div>

      {petGuides.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          반려동물을 먼저 등록해주세요
        </div>
      ) : (
        petGuides.map(({ pet, age, guides }) => (
          <div key={pet.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{pet.name}</span>
              <span className="text-sm text-gray-400">{age.displayText}</span>
            </div>

            {guides.length === 0 ? (
              <div className="card text-sm text-gray-400 py-4 text-center">
                현재 나이에 해당하는 가이드가 없어요
              </div>
            ) : (
              guides.map(guide => (
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
    </div>
  )
}

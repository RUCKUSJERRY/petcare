import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge } from '@/lib/utils'
import type { WalkGuide, Pet } from '@/types'

const intensityColor = (i: string) => ({
  '가벼움': 'bg-blue-100 text-blue-700',
  '보통': 'bg-green-100 text-green-700',
  '활발': 'bg-orange-100 text-orange-700',
}[i] ?? 'bg-gray-100 text-gray-700')

export default async function WalkPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .eq('user_id', user!.id)

  const petGuides = await Promise.all(
    (pets ?? []).map(async (pet: Pet) => {
      const age = calcPetAge(pet.birth_year, pet.birth_month)
      const { data: guides } = await supabase
        .from('walk_guides')
        .select('*')
        .or(`breed_id.eq.${pet.breed_id},breed_id.is.null`)
        .lte('age_month_min', age.months)
        .gte('age_month_max', age.months)
        .limit(1)
        .single()
      return { pet, age, guide: guides as WalkGuide | null }
    })
  )

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">산책 가이드</h1>

      {petGuides.map(({ pet, age, guide }) => (
        <div key={pet.id} className="card space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{pet.name}</span>
            <span className="text-sm text-gray-400">{age.displayText}</span>
          </div>

          {!guide ? (
            <p className="text-sm text-gray-400">가이드 준비 중이에요</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="text-center bg-primary-50 rounded-xl px-4 py-3 flex-1">
                  <div className="text-2xl font-bold text-primary-600">{guide.daily_minutes}</div>
                  <div className="text-xs text-primary-400 mt-0.5">일일 권장 분</div>
                </div>
                <div className="text-center bg-gray-50 rounded-xl px-4 py-3 flex-1">
                  <div className={`text-sm font-semibold px-2 py-1 rounded-full inline-block ${intensityColor(guide.intensity)}`}>
                    {guide.intensity}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">운동 강도</div>
                </div>
              </div>
              {guide.tips && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  {guide.tips}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

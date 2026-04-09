import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import Link from 'next/link'
import type { Pet } from '@/types'
import { LogoutButton } from '@/components/ui/LogoutButton'

export default async function PetsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .eq('user_id', user!.id)
    .order('created_at')

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">내 아이</h1>
        <div className="flex items-center gap-2">
          <Link href="/pets/new" className="btn-primary text-sm py-1.5 px-3">
            + 등록
          </Link>
          <LogoutButton />
        </div>
      </div>

      {!pets || pets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🐶</div>
          <p className="text-gray-500 text-sm">아직 등록된 반려동물이 없어요</p>
          <Link href="/pets/new" className="btn-primary inline-block mt-4 text-sm">
            첫 아이 등록하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(pets as Pet[]).map(pet => {
            const age = calcPetAge(pet.birth_year, pet.birth_month)
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
                <div className="card flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {pet.photo_url
                      ? <img src={pet.photo_url} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                      : '🐾'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{pet.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                        {age.lifeStage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {(pet as any).breed?.name_ko} · {age.displayText} · {pet.gender}
                    </p>
                    {pet.weight_kg && (
                      <p className="text-xs text-gray-400 mt-0.5">{pet.weight_kg}kg</p>
                    )}
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

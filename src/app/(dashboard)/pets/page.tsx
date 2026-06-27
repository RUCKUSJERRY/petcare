import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calcPetAge, lifeStageColor } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { PetAvatar } from '@/components/ui/PetAvatar'
import type { Pet } from '@/types'

export default async function PetsPage() {
  const t = await getTranslations('pets')
  const supabase = await createServerSupabaseClient()
  await supabase.auth.getUser()

  // 멤버십 기반 RLS가 "내가 구성원인 반려동물"만 반환 (공동 관리 아이 포함)
  const { data: pets } = await supabase
    .from('pets')
    .select('*, breed:breeds(*)')
    .order('created_at')

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <Link href="/pets/new" className="btn-primary text-sm py-1.5 px-3">
          {t('register')}
        </Link>
      </div>

      {!pets || pets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🐶</div>
          <p className="text-gray-500 text-sm">{t('empty')}</p>
          <Link href="/pets/new" className="btn-primary inline-block mt-4 text-sm">
            {t('registerFirst')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(pets as Pet[]).map(pet => {
            const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`}>
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

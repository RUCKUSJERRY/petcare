'use client'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Pet } from '@/types'

// 펫 선택이 의미 없는 페이지
const HIDDEN_PATHS = ['/community', '/profile', '/pets', '/dashboard']

export function PetSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedPetId = searchParams.get('pet')
  const supabase = createClient()

  const { data: pets } = useQuery({
    queryKey: ['my-pets-switcher'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as Pet[]
      const { data } = await supabase
        .from('pets')
        .select('id, name, species, photo_url')
        .eq('user_id', user.id)
        .order('created_at')
      return (data ?? []) as Pet[]
    },
  })

  const hidden = HIDDEN_PATHS.some(p => pathname.startsWith(p))
  if (hidden || !pets || pets.length <= 1) return null

  const select = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('pet') === id) {
      params.delete('pet')
    } else {
      params.set('pet', id)
    }
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex items-center gap-2 px-4 pt-4 overflow-x-auto scrollbar-none">
      <span className="text-xs text-gray-400 font-medium shrink-0">우리 아이:</span>
      {pets.map(pet => (
        <button
          key={pet.id}
          onClick={() => select(pet.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 border',
            selectedPetId === pet.id
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-600 border-gray-200'
          )}
        >
          <span>{pet.species === 'cat' ? '🐱' : '🐶'}</span>
          <span>{pet.name}</span>
        </button>
      ))}
    </div>
  )
}

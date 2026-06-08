'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { Pet } from '@/types'

export function AppHeader() {
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const supabase = createClient()

  const { data: pets } = useQuery({
    queryKey: ['my-pets-header'],
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

  if (!pets || pets.length === 0) return null

  const toggle = (id: string) => {
    setSelectedPetId(selectedPetId === id ? null : id)
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-2.5">
        {/* 펫 칩 목록 */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none min-w-0">
          {pets.map(pet => (
            <button
              key={pet.id}
              onClick={() => toggle(pet.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border',
                selectedPetId === pet.id
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300'
              )}
            >
              {pet.photo_url ? (
                <img src={pet.photo_url} className="w-4 h-4 rounded-full object-cover" alt="" />
              ) : (
                <span className="text-sm leading-none">{pet.species === 'cat' ? '🐱' : '🐶'}</span>
              )}
              <span>{pet.name}</span>
            </button>
          ))}
        </div>

        {/* 프로필 버튼 */}
        <Link
          href="/profile"
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 shrink-0 transition-colors"
          aria-label="프로필"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

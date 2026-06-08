'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect } from 'react'
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

  // 안읽은 알림 수 (주기적 갱신)
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
      return count ?? 0
    },
    refetchInterval: 60_000,
  })

  // 자가 복구: 선택된 아이가 삭제되는 등으로 목록에 없으면 선택 해제
  useEffect(() => {
    if (pets && selectedPetId && !pets.some(p => p.id === selectedPetId)) {
      setSelectedPetId(null)
    }
  }, [pets, selectedPetId, setSelectedPetId])

  const toggle = (id: string) => {
    setSelectedPetId(selectedPetId === id ? null : id)
  }

  const hasPets = !!pets && pets.length > 0

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-2.5">
        {/* 펫 칩 목록 (없으면 빈 공간으로 우측 버튼 정렬 유지) */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none min-w-0">
          {hasPets ? (
            pets!.map(pet => (
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
            ))
          ) : (
            <Link href="/dashboard" className="text-sm font-bold text-primary-600">🐾 펫케어</Link>
          )}
        </div>

        {/* 알림 종 */}
        <Link
          href="/notifications"
          className="relative w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 shrink-0 transition-colors"
          aria-label={unread > 0 ? `알림 ${unread}건` : '알림'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

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

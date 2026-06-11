'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { NotificationBell } from './NotificationBell'

export function AppHeader() {
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const petsActive = pathname.startsWith('/pets')
  const profileActive = pathname.startsWith('/profile')

  const { data: pets } = useMyPets()

  // 자가 복구: 선택된 아이가 삭제되는 등으로 목록에 없으면 선택 해제
  useEffect(() => {
    if (pets && selectedPetId && !pets.some(p => p.id === selectedPetId)) {
      setSelectedPetId(null)
    }
  }, [pets, selectedPetId, setSelectedPetId])

  // 실시간 알림: 내 알림이 생성/변경되면 배지·목록 즉시 갱신
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
          }
        )
        .subscribe()
    })()
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
    // supabase/queryClient는 안정적 참조라 마운트 시 1회만 구독
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id: string) => {
    setSelectedPetId(selectedPetId === id ? null : id)
  }

  const hasPets = !!pets && pets.length > 0

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-2.5">
        {/* 내 아이 관리 진입 (칩 선택 좌측) */}
        <Link
          href="/pets"
          aria-label="내 아이 관리"
          aria-current={petsActive ? 'page' : undefined}
          className={cn(
            'shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-base transition-colors',
            petsActive
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
              : 'border-gray-200 hover:bg-gray-50'
          )}
        >
          🐾
        </Link>

        {/* 펫 칩 목록 (없으면 빈 공간으로 우측 버튼 정렬 유지) */}
        <div data-tour="pets" className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none min-w-0">
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
            <Link href="/pets/new" className="text-sm font-medium text-primary-600">내 아이 등록하기 →</Link>
          )}
        </div>

        {/* 알림 종 (드롭다운) */}
        <NotificationBell />

        {/* 프로필 버튼 */}
        <Link
          href="/profile"
          aria-current={profileActive ? 'page' : undefined}
          className={cn(
            'w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors',
            profileActive
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 text-primary-600'
              : 'border-gray-200 text-gray-400 hover:bg-gray-50'
          )}
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

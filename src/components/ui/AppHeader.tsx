'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useMyPets } from '@/hooks/useMyPets'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { NotificationBell } from './NotificationBell'
import { PetAvatar } from './PetAvatar'

export function AppHeader() {
  const t = useTranslations('header')
  const { selectedPetId, setSelectedPetId, hydrated } = useSelectedPet()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const petsActive = pathname.startsWith('/pets')
  const profileActive = pathname.startsWith('/profile')

  const { data: pets } = useMyPets()
  // 첫 아이 자동 선택을 마운트당 1회만 수행 (수동 해제는 존중)
  const autoSelected = useRef(false)

  // 자가 복구 + 첫 아이 자동 선택
  useEffect(() => {
    if (!pets) return
    // 선택된 아이가 삭제되는 등으로 목록에 없으면 선택 해제
    if (selectedPetId && !pets.some(p => p.id === selectedPetId)) {
      setSelectedPetId(null)
      return
    }
    // localStorage 복원(hydrated) 전에는 기본 선택하지 않는다 — 저장된 선택을 pets[0]로
    // 덮어써 깜빡이는 것을 막는다. 복원 후에도 선택이 없으면 첫 아이를 자동 선택한다.
    // (기존엔 1마리일 때만 자동 선택돼, 다견 사용자는 첫 진입 시 홈 요약카드·원탭 기록이
    //  통째로 비어 칩을 탭해야 화면이 '켜지는' 문제가 있었다. 단·다견 동일하게 동작한다.)
    if (hydrated && !selectedPetId && !autoSelected.current && pets.length >= 1) {
      autoSelected.current = true
      setSelectedPetId(pets[0].id)
    }
  }, [pets, selectedPetId, setSelectedPetId, hydrated])

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

  const selectPet = (id: string) => {
    // 이미 선택된 아이를 다시 눌러도 선택을 해제하지 않는다(칩 탭은 '선택 전환'만 담당).
    // 예전엔 다견일 때 재탭으로 해제됐는데, 해제되면 홈 요약 카드(아바타·다음 접종 알림·원탭
    // 기록·체중)가 통째로 사라져 사용자가 화면이 깨진 것으로 오인했다. 단·다견 동일하게 동작한다.
    setSelectedPetId(id)
  }

  const hasPets = !!pets && pets.length > 0

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-2.5">
        {/* 내 아이 관리 진입 (칩 선택 좌측) */}
        <Link
          href="/pets"
          aria-label={t('myPetsAria')}
          aria-current={petsActive ? 'page' : undefined}
          className={cn(
            'shrink-0 w-10 h-10 rounded-full border flex items-center justify-center text-base transition-colors',
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
            <>
              {pets!.map(pet => (
                <button
                  key={pet.id}
                  onClick={() => selectPet(pet.id)}
                  // 선택 상태를 색으로만 표시하면 색각 이상·스크린리더 사용자가 '지금 어떤 아이가
                  // 선택됐는지'(앱 전체 범위를 좌우하는 상태)를 알 수 없다 — aria-pressed 로 노출한다.
                  aria-pressed={selectedPetId === pet.id}
                  className={cn(
                    // 탭 타깃 확대: py-1.5(~30px)는 오탭이 잦았다. 헤더의 '내 아이' 버튼(h-10=40px)과
                    // 같은 높이로 맞춰(min-h-10) 헤더 높이 변화 없이 히트 영역을 넓힌다. 이 칩은 앱 전체
                    // 데이터 범위를 좌우하는 컨트롤이라 오탭 시 파급이 커, 크기를 우선 키웠다.
                    'flex items-center gap-1.5 px-3 py-1.5 min-h-10 rounded-full text-xs font-medium transition-all shrink-0 border',
                    selectedPetId === pet.id
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300'
                  )}
                >
                  <PetAvatar photoUrl={pet.photo_url} species={pet.species}
                    className="w-4 h-4" emojiClassName="text-sm leading-none" />
                  <span>{pet.name}</span>
                </button>
              ))}
              {/* 다른 아이 추가 — 이미 아이가 있을 때도 한 번에 등록으로 진입 (기존엔 아이 목록을 거쳐야 했다) */}
              <Link
                href="/pets/new"
                aria-label={t('addPetAria')}
                className="shrink-0 w-10 h-10 rounded-full border border-dashed border-gray-300 text-gray-500 flex items-center justify-center text-lg leading-none hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                +
              </Link>
            </>
          ) : (
            <Link href="/pets/new" className="text-sm font-medium text-primary-600">{t('registerPet')}</Link>
          )}
        </div>

        {/* 알림 종 (드롭다운) */}
        <NotificationBell />

        {/* 프로필 버튼 */}
        <Link
          href="/profile"
          aria-current={profileActive ? 'page' : undefined}
          className={cn(
            'w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors',
            profileActive
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200 text-primary-600'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
          aria-label={t('profile')}
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

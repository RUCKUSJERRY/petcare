'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const t = useTranslations('ui')
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // 다음 사용자가 같은 브라우저로 로그인할 때 이전 사용자의 캐시(펫 목록·요금제 등)를
    // 보지 않도록 로그아웃 시 전체 쿼리 캐시를 비운다. (키가 사용자별로 분리돼 있지 않음)
    queryClient.clear()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
    >
      {t('logout')}
    </button>
  )
}

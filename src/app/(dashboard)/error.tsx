'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

/**
 * 대시보드 세그먼트 공용 에러 바운더리.
 *
 * 홈·일정·비용·건강 등 대시보드 화면은 대부분 서버 컴포넌트에서 Supabase 조회(.from/.rpc)를
 * 직접 수행한다. 조회가 실제로 throw(장애·RLS 회귀·네트워크)하면 예전엔 Next.js 기본
 * 미스타일 에러 화면이 그대로 노출돼 복구 경로가 없었다. 이 바운더리가 앱 톤에 맞는 안내와
 * '다시 시도'(reset) CTA를 제공해, 최악의 실패 상태를 사용자 친화적으로 바꾼다.
 *
 * (조회의 '빈 결과 vs 실패'를 구분해 부드럽게 처리하는 화면들[예: PetSection]은 그대로 두고,
 *  실제로 예외가 던져진 경우의 마지막 안전망 역할만 한다.)
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('system')
  useEffect(() => {
    // 운영 로깅(예: Vercel 로그)으로 원인 추적. digest 는 서버 에러와 매칭되는 식별자.
    console.error('[dashboard] 화면 렌더 오류', error)
  }, [error])

  return (
    <div className="px-4 py-16">
      <div className="card text-center py-12 text-gray-500 space-y-3 max-w-sm mx-auto">
        <div className="text-4xl" aria-hidden>🐾</div>
        <p className="font-semibold text-gray-800">{t('dashErrorTitle')}</p>
        <p className="text-xs px-4 leading-relaxed">
          {t('dashErrorDesc')}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button type="button" onClick={reset} className="btn-primary text-sm">
            {t('retry')}
          </button>
          <Link href="/dashboard" className="btn-secondary text-sm">
            {t('dashErrorHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

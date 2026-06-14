'use client'

import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

function LoginContent() {
  const t = useTranslations('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const searchParams = useSearchParams()

  // 콜백/공급자 단계에서 실패해 돌아온 경우 안내 (?error=...)
  useEffect(() => {
    if (searchParams.get('error')) {
      setError(t('failed'))
    }
  }, [searchParams, t])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    // 성공 시엔 구글로 리다이렉트되어 이 줄에 도달하지 않는다.
    // 실패 시 버튼이 '로그인 중...'에 영구 고착되지 않도록 복구한다.
    if (oauthErr) {
      setError(t('failedRetry'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* 로고 영역 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🐾</div>
          <h1 className="text-2xl font-bold text-gray-900">{t('appName')}</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {t('tagline')}
          </p>
        </div>

        <div className="card space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {loading ? t('loading') : t('google')}
          </button>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('terms')}
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}

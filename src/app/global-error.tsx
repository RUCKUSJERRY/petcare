'use client'

import { useEffect } from 'react'

/**
 * 루트 전역 에러 바운더리 — 루트 레이아웃 자체가 렌더에 실패한 경우의 최후 안전망.
 *
 * global-error 는 root layout 을 대체하므로 반드시 자체 <html>·<body> 를 렌더해야 한다.
 * next-intl 등 프로바이더 컨텍스트가 없을 수 있어(레이아웃 실패 상황) 정적 한국어로 안내한다.
 * 세그먼트 단위 오류는 (dashboard)/error.tsx 가 먼저 잡고, 여기까지 오는 경우는 드물다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global] 앱 렌더 오류', error)
  }, [error])

  return (
    <html lang="ko">
      <body style={{ margin: 0, background: '#f9fafb', color: '#111827', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '320px' }}>
            <div style={{ fontSize: '40px' }} aria-hidden>🐾</div>
            <p style={{ fontWeight: 600, marginTop: '12px' }}>앱에 문제가 생겼어요</p>
            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6, marginTop: '8px' }}>
              잠시 후 다시 시도해 주세요. 문제가 계속되면 앱을 새로고침해 주세요.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: '16px', background: '#2d8a42', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

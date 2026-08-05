'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { isPushSupported, getPushEnabled, subscribeToPush } from '@/lib/pushClient'

const DISMISS_KEY = 'push-nudge-dismissed'

/**
 * 홈 상단 '알림 켜기' 넛지 배너.
 *
 * 알림 설정(푸시 토글)은 프로필 맨 아래에 묻혀 있어, 온보딩에서 권한을 놓친 사용자는 재방문을
 * 유도하는 핵심 장치(기념일·연속기록·주간리포트·케어 리마인더 푸시)를 켤 기회 자체가 없었다.
 * 아직 구독하지 않은 사용자에게만 가볍게 한 번 권하고, 닫으면(localStorage) 다시 조르지 않는다.
 *
 * 지원 안 함/이미 켜짐/닫음 상태에서는 아무것도 렌더링하지 않는다(자기 노출 판단).
 */
export function PushNudge() {
  const t = useTranslations('ui')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) return
    // 이미 닫았으면 다시 띄우지 않는다.
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch { /* 접근 불가 시 노출 시도 */ }
    if (dismissed) return
    // 이미 구독(알림 켜짐)이면 넛지 불필요.
    getPushEnabled().then(enabled => { if (!enabled) setShow(true) }).catch(() => {})
  }, [])

  if (!show) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* 저장 실패해도 이 세션에선 닫힘 */ }
    setShow(false)
  }

  const enable = async () => {
    setBusy(true); setError(null)
    try {
      await subscribeToPush()
      setShow(false)
    } catch (e) {
      setError(e instanceof Error && e.message === 'denied' ? t('pushPermissionDenied') : t('pushEnableFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50 p-3.5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{t('pushNudgeTitle')}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t('pushNudgeDesc')}</p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="btn-primary text-xs font-semibold px-3.5 py-1.5 disabled:opacity-60"
            >
              {t('pushNudgeCta')}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="text-xs font-medium text-gray-400 px-2 py-1.5"
            >
              {t('pushNudgeDismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

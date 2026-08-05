'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { VAPID_PUBLIC_KEY, isPushSupported, getPushEnabled, subscribeToPush } from '@/lib/pushClient'

export function PushToggle() {
  const t = useTranslations('ui')
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<string | null>(null)

  useEffect(() => {
    const ok = isPushSupported()
    setSupported(ok)
    if (!ok) return
    getPushEnabled().then(setEnabled).catch(() => {})
  }, [])

  // VAPID 키가 없으면(설정 전) 토글 자체를 노출하지 않음
  if (!VAPID_PUBLIC_KEY) return null

  const enable = async () => {
    setBusy(true); setError(null)
    try {
      await subscribeToPush()
      setEnabled(true)
    } catch (e) {
      // 권한 거부와 그 외 실패를 구분해 안내한다(공용 subscribeToPush 가 코드로 던짐).
      setError(e instanceof Error && e.message === 'denied' ? t('pushPermissionDenied') : t('pushEnableFailed'))
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true); setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEnabled(false)
    } catch {
      setError(t('pushDisableFailed'))
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true); setError(null); setDiag(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { setError(t('pushTestFailed', { error: d.error ?? res.status })); return }
      // 진단 결과 안내
      if (!d.vapidConfigured) setDiag(t('pushDiagNoVapid'))
      else if (!d.serviceRoleConfigured) setDiag(t('pushDiagNoServiceRole'))
      else if (d.subscriptions === 0) setDiag(t('pushDiagNoSubscriptions'))
      else setDiag(t('pushDiagSent'))
    } catch {
      setError(t('pushTestError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{t('pushTitle')}</p>
          <p className="text-xs text-gray-400">{t('pushDesc')}</p>
        </div>
        {supported ? (
          <button
            onClick={enabled ? disable : enable}
            disabled={busy}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-primary-500' : 'bg-gray-300'} disabled:opacity-60`}
            aria-pressed={enabled}
            aria-label={t('pushToggleLabel')}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
          </button>
        ) : (
          <span className="text-xs text-gray-400 shrink-0">{t('pushUnsupported')}</span>
        )}
      </div>
      {enabled && (
        <button onClick={sendTest} disabled={busy} className="text-xs text-primary-600 font-medium disabled:opacity-60">
          {t('pushSendTest')}
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {diag && <p className="text-xs text-gray-500">{diag}</p>}
    </div>
  )
}

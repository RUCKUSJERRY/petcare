'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function PushToggle() {
  const t = useTranslations('ui')
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diag, setDiag] = useState<string | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      !!VAPID_PUBLIC_KEY
    setSupported(ok)
    if (!ok) return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  // VAPID 키가 없으면(설정 전) 토글 자체를 노출하지 않음
  if (!VAPID_PUBLIC_KEY) return null

  const enable = async () => {
    setBusy(true); setError(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setError(t('pushPermissionDenied')); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as unknown as BufferSource,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new Error('save failed')
      setEnabled(true)
    } catch {
      setError(t('pushEnableFailed'))
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

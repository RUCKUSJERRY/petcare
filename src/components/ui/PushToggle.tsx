'use client'

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
      if (perm !== 'granted') { setError('알림 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.'); return }
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
      setError('알림 설정에 실패했어요. 다시 시도해주세요.')
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
      setError('해제에 실패했어요. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true); setError(null); setDiag(null)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { setError(`테스트 실패: ${d.error ?? res.status}`); return }
      // 진단 결과 안내
      if (!d.vapidConfigured) setDiag('⚠️ 서버에 VAPID 키가 설정되지 않았어요 (환경변수 확인 필요)')
      else if (!d.serviceRoleConfigured) setDiag('⚠️ 서버에 SERVICE_ROLE 키가 없어요 (환경변수 확인 필요)')
      else if (d.subscriptions === 0) setDiag('⚠️ 저장된 구독이 없어요. 토글을 껐다 다시 켜보세요')
      else setDiag('✅ 발송했어요. 잠시 후 OS 알림(우측 하단)을 확인하세요')
    } catch {
      setError('테스트 중 오류가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">푸시 알림</p>
          <p className="text-xs text-gray-400">댓글·답글·좋아요·건강 일정 알림을 기기로 받기</p>
        </div>
        {supported ? (
          <button
            onClick={enabled ? disable : enable}
            disabled={busy}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-primary-500' : 'bg-gray-300'} disabled:opacity-60`}
            aria-pressed={enabled}
            aria-label="푸시 알림 토글"
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
          </button>
        ) : (
          <span className="text-xs text-gray-400 shrink-0">미지원 기기</span>
        )}
      </div>
      {enabled && (
        <button onClick={sendTest} disabled={busy} className="text-xs text-primary-600 font-medium disabled:opacity-60">
          테스트 알림 보내기
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {diag && <p className="text-xs text-gray-500">{diag}</p>}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/**
 * 연속 기록(streak) 리마인더 푸시 옵트인 토글 (기본 off).
 * 켜져 있어도 실제 발송은 푸시 알림(구독)이 켜져 있어야 도착한다 — 설명 문구로 안내한다.
 * 상태는 /api/push/streak-pref (본인 profiles) 에서 읽고 쓴다. (TipPushToggle 과 동일 패턴)
 */
export function StreakPushToggle() {
  const t = useTranslations('ui')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/push/streak-pref')
      .then(r => (r.ok ? r.json() : { enabled: false }))
      .then(d => setEnabled(!!d.enabled))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // VAPID 키가 없으면(푸시 미설정) 토글도 노출하지 않음 (PushToggle 과 동일 기준)
  if (!VAPID_PUBLIC_KEY) return null

  const toggle = async () => {
    const next = !enabled
    setBusy(true)
    setEnabled(next) // 낙관적 반영
    try {
      const res = await fetch('/api/push/streak-pref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch {
      setEnabled(!next) // 실패 시 되돌림
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{t('streakPushTitle')}</p>
        <p className="text-xs text-gray-400">{t('streakPushDesc')}</p>
      </div>
      <button
        onClick={toggle}
        disabled={busy || !loaded}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-primary-500' : 'bg-gray-300'} disabled:opacity-60`}
        aria-pressed={enabled}
        aria-label={t('streakPushTitle')}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

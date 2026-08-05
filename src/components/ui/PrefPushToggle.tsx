'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { VAPID_PUBLIC_KEY } from '@/lib/pushClient'
import { Switch } from './Switch'

/**
 * 옵트인(기본 off) 푸시 채널 토글 (팁·연속기록·주간리포트·기념일 등 공통).
 *
 * 이 채널들은 동작이 완전히 동일하다 — 본인 profiles 의 pref 를 GET 으로 읽고, 스위치를 누르면
 * POST 로 저장(낙관적 반영, 실패 시 되돌림)한다. 채널마다 다른 건 저장 엔드포인트와 표시 문구뿐이라,
 * 예전엔 65줄짜리 토글 컴포넌트 4개가 거의 동일하게 복붙돼 있었다. 이 공용 컴포넌트로 일원화한다.
 * (구독 자체를 켜는 PushToggle 은 로직이 달라 별도로 둔다.)
 *
 * 켜져 있어도 실제 발송은 푸시 알림(구독)이 켜져 있어야 도착한다 — 설명 문구(descKey)로 안내한다.
 *
 * @param endpoint /api/push/ 아래 pref 엔드포인트 경로 (예: 'tip-pref')
 * @param titleKey ui 네임스페이스의 제목 i18n 키
 * @param descKey  ui 네임스페이스의 설명 i18n 키
 */
export function PrefPushToggle({
  endpoint,
  titleKey,
  descKey,
}: {
  endpoint: string
  titleKey: string
  descKey: string
}) {
  const t = useTranslations('ui')
  const url = `/api/push/${endpoint}`
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(url)
      .then(r => (r.ok ? r.json() : { enabled: false }))
      .then(d => setEnabled(!!d.enabled))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [url])

  // VAPID 키가 없으면(푸시 미설정) 토글도 노출하지 않음 (PushToggle 과 동일 기준)
  if (!VAPID_PUBLIC_KEY) return null

  const toggle = async () => {
    const next = !enabled
    setBusy(true)
    setEnabled(next) // 낙관적 반영
    try {
      const res = await fetch(url, {
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
        <p className="text-sm font-medium text-gray-700">{t(titleKey)}</p>
        <p className="text-xs text-gray-400">{t(descKey)}</p>
      </div>
      <Switch enabled={enabled} onToggle={toggle} disabled={busy || !loaded} ariaLabel={t(titleKey)} />
    </div>
  )
}

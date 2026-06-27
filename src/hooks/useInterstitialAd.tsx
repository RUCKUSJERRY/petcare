'use client'

import { useCallback, useRef, useState } from 'react'
import { AdInterstitial } from '@/components/ui/AdInterstitial'
import { usePlan } from '@/hooks/usePlan'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Species } from '@/types'

const LAST_AD_KEY = 'petcare:lastInterstitialAt'

/** 직전 광고로부터 cooldown(ms) 이 지나지 않았으면 true (광고 생략). */
function withinCooldown(cooldownMs: number): boolean {
  if (typeof window === 'undefined' || cooldownMs <= 0) return false
  const raw = window.localStorage.getItem(LAST_AD_KEY)
  const last = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(last) && Date.now() - last < cooldownMs
}

function markAdShown() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_AD_KEY, String(Date.now()))
}

/**
 * 특정 행동(예: 산책 시작) 직전에 전면 광고를 노출하는 게이트.
 *
 * 사용:
 *   const { requestAd, adNode } = useInterstitialAd()
 *   <button onClick={() => requestAd(start)}>산책 시작</button>
 *   {adNode}
 *
 * - 프리미엄 사용자 / 광고 비활성화 시에는 광고 없이 즉시 행동을 실행한다.
 */
export function useInterstitialAd(species?: Species) {
  const { isPremium } = usePlan()
  const { adsEnabled, adCooldownMs } = useAppSettings()
  const [open, setOpen] = useState(false)
  const actionRef = useRef<(() => void) | null>(null)

  const requestAd = useCallback((action: () => void) => {
    // 프리미엄 / 광고 비활성 / 최근에 이미 광고를 봤으면(cooldown) 즉시 실행
    if (isPremium || !adsEnabled || withinCooldown(adCooldownMs)) {
      action()
      return
    }
    markAdShown() // 취소해도 cooldown 이 적용되도록 노출 시점에 기록(연속 노출 방지)
    actionRef.current = action
    setOpen(true)
  }, [isPremium, adsEnabled, adCooldownMs])

  const run = useCallback(() => {
    const action = actionRef.current
    actionRef.current = null
    setOpen(false)
    action?.()
  }, [])

  const cancel = useCallback(() => {
    actionRef.current = null
    setOpen(false)
  }, [])

  const adNode = open
    ? <AdInterstitial species={species} onComplete={run} onCancel={cancel} />
    : null

  return { requestAd, adNode }
}

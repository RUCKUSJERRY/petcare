'use client'

import { useCallback, useRef, useState } from 'react'
import { AdInterstitial } from '@/components/ui/AdInterstitial'
import { usePlan } from '@/hooks/usePlan'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Species } from '@/types'

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
  const { adsEnabled } = useAppSettings()
  const [open, setOpen] = useState(false)
  const actionRef = useRef<(() => void) | null>(null)

  const requestAd = useCallback((action: () => void) => {
    if (isPremium || !adsEnabled) {
      action()
      return
    }
    actionRef.current = action
    setOpen(true)
  }, [isPremium, adsEnabled])

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

'use client'

import { useEffect } from 'react'

/** 서비스 워커 등록 (PWA 설치·오프라인·푸시 기반). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 등록 실패는 치명적이지 않음 (앱은 정상 동작)
      })
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}

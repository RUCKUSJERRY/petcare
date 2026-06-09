'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import { hasKakaoKey, loadKakaoMaps } from '@/lib/kakao'

type Status = 'loading' | 'ready' | 'no-key' | 'error'

/**
 * 카카오맵 컨테이너 + 로드 상태 관리.
 * onReady(maps, container)에서 지도를 초기화한다. (cleanup 반환 가능)
 * 로드 실패/키 없음을 status로 노출해 화면에서 안내할 수 있다.
 */
export function useKakaoMap(
  onReady: (maps: any, container: HTMLElement) => void | (() => void),
  deps: React.DependencyList
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!hasKakaoKey()) { setStatus('no-key'); return }
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    let cleanup: void | (() => void)
    loadKakaoMaps()
      .then(maps => {
        if (cancelled || !el) return
        setStatus('ready')
        cleanup = onReady(maps, el)
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true; if (typeof cleanup === 'function') cleanup() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { containerRef, status }
}

/** 지도 로드 실패/키 없음 안내 문구 (없으면 null) */
export function kakaoNotice(status: Status): string | null {
  if (status === 'no-key') return '🗺️ 지도를 보려면 카카오맵 키(NEXT_PUBLIC_KAKAO_MAP_KEY) 설정이 필요해요.'
  if (status === 'error') return '🗺️ 지도를 불러오지 못했어요. 카카오 개발자 콘솔에 현재 도메인이 등록됐는지 확인해주세요.'
  return null
}

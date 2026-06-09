/* 카카오맵 JS SDK 로더 (services 라이브러리 포함: 지오코딩/장소검색)
 * NEXT_PUBLIC_KAKAO_MAP_KEY 가 없으면 거부 → 화면에서 안내 처리. */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any
  }
}

let loaderPromise: Promise<any> | null = null

export function hasKakaoKey(): boolean {
  return !!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
}

export function loadKakaoMaps(): Promise<any> {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (!key) return Promise.reject(new Error('NO_KEY'))
  if (window.kakao?.maps) return Promise.resolve(window.kakao.maps)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao.maps))
    script.onerror = () => { loaderPromise = null; reject(new Error('LOAD_FAIL')) }
    document.head.appendChild(script)
  })
  return loaderPromise
}

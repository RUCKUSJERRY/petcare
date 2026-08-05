/**
 * 웹푸시 구독 클라이언트 공용 로직.
 * 프로필의 PushToggle 과 홈의 PushNudge 가 동일한 구독 절차를 쓰도록 한곳에 모았다
 * (구독 흐름이 갈라져 한쪽만 고쳐지는 일을 막는다). 브라우저 전용 API 라 클라이언트에서만 호출한다.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** 구독 실패 원인을 호출부가 구분할 수 있게 코드로 던진다. */
export type PushSubscribeError = 'unsupported' | 'denied' | 'failed'

/** 이 브라우저가 웹푸시를 지원하고 VAPID 키가 설정돼 있는지 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** 이미 이 브라우저에 푸시 구독이 있는지(=알림이 켜져 있는지) */
export async function getPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

/**
 * 알림 권한을 요청하고 구독을 생성해 서버에 저장한다.
 * 실패 시 원인을 PushSubscribeError 코드로 throw 한다(호출부에서 메시지 매핑).
 */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) throw new Error('unsupported' satisfies PushSubscribeError)
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('denied' satisfies PushSubscribeError)
  try {
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
    if (!res.ok) throw new Error('failed' satisfies PushSubscribeError)
  } catch (e) {
    if (e instanceof Error && (e.message === 'denied' || e.message === 'failed')) throw e
    throw new Error('failed' satisfies PushSubscribeError)
  }
}

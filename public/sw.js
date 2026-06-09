/* 펫케어 서비스 워커
 * - 정적 셸을 캐시해 오프라인/재방문 속도 개선 (network-first, 실패 시 캐시)
 * - 푸시 수신/클릭 처리 (Phase B 웹 푸시용)
 */
const CACHE = 'petcare-v1'
const SHELL = ['/', '/dashboard', '/offline', '/icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 네비게이션 요청만 처리: 네트워크 우선, 실패 시 캐시/오프라인 폴백
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {})
        return res
      })
      .catch(async () => {
        const cached = await caches.match(request)
        return cached || caches.match('/offline') || caches.match('/dashboard')
      })
  )
})

// ── 웹 푸시 (Phase B) ────────────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch (_) {}
  const title = payload.title || '펫케어'
  const options = {
    body: payload.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: payload.url || '/dashboard' },
    tag: payload.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(url); return client.focus() }
      }
      return self.clients.openWindow(url)
    })
  )
})

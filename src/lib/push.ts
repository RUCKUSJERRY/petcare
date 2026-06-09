import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured: boolean | null = null

/** VAPID 설정. 키가 없거나 형식이 잘못되면 false(푸시 비활성) — 앱은 정상 동작. */
function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  let subject = process.env.VAPID_SUBJECT || 'mailto:admin@petcare.app'
  // mailto:/https: 형식이 아니면 보정 (web-push가 거부하므로)
  if (!/^(mailto:|https?:)/.test(subject)) subject = `mailto:${subject}`
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  } catch (err) {
    console.error('[push] VAPID 설정 실패:', err)
    configured = false
  }
  return configured
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * 특정 사용자의 모든 구독 기기로 푸시 발송 (베스트 에포트).
 * 만료(404/410)된 구독은 자동 삭제. 실패해도 예외를 던지지 않음.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return
  try {
    const admin = createAdminClient()
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (!subs || subs.length === 0) return

    const body = JSON.stringify(payload)
    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          )
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      })
    )
  } catch {
    // 발송 실패는 무시 (알림 자체는 DB에 이미 저장됨)
  }
}

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { getTranslations } from 'next-intl/server'

/**
 * 새 목격 제보에 대한 폰 푸시 발송. 클라이언트가 제보 저장 성공 후 호출한다.
 * in-app 알림은 DB 트리거(notify_on_sighting)가 이미 남기므로, 여기선 폰 푸시만 담당한다.
 * (실종은 가장 시급한 이벤트라 앱을 열어두지 않은 신고자에게도 즉시 닿게 한다.)
 */
export async function notifyNewSighting(sightingId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: s } = await supabase
    .from('lost_pet_sightings')
    .select('lost_pet_id, content, user_id')
    .eq('id', sightingId)
    .maybeSingle()
  const sighting = s as { lost_pet_id: string; content: string; user_id: string } | null
  if (!sighting) return
  // 호출자가 실제 이 제보의 작성자일 때만 푸시 (임의 id로 남에게 반복 푸시하는 스팸 방지)
  if (sighting.user_id !== user.id) return

  const { data: lost } = await supabase
    .from('lost_pets')
    .select('user_id, name')
    .eq('id', sighting.lost_pet_id)
    .maybeSingle()
  const pet = lost as { user_id: string; name: string | null } | null
  if (!pet || pet.user_id === user.id) return

  const t = await getTranslations('lost')
  await sendPushToUser(pet.user_id, {
    title: t('sightingPushTitle', { name: pet.name ?? t('unknownName') }),
    body: sighting.content.slice(0, 60),
    url: `/lost/${sighting.lost_pet_id}`,
    tag: `sighting-${sighting.lost_pet_id}`,
  })
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordCategory } from '@/types'
import { nextOccurrence, parseRule, parseYMD, ymd } from './recurrence'
import { todayKST } from './utils'

/** 빠른 완료 처리에 필요한 최소 정보 */
export type CompletableCareItem = {
  pet_id: string
  category: RecordCategory | string
  title: string
  recur_rule?: string | null
}

/**
 * 케어 일정을 "완료"로 기록한다.
 * - 같은 아이·카테고리·항목으로 시행일(eventOn) 기준 기록을 한 건 추가한다.
 *   (일정 집계는 항목 라인별 "최신 기록" 기준이라, 이 기록이 최신이 되어 일정이 갱신됨)
 * - 반복 규칙이 있으면 시행일 이후의 다음 발생일을 next_due로 넣어 일정이 앞으로 굴러간다.
 * - 반복이 아니면 next_due를 비워 완료된 일정으로 처리(예정 목록에서 사라짐).
 *
 * @param eventOn 실제 시행일(YYYY-MM-DD). 기본은 KST '오늘'. 반복 규칙(매월 N일·매년)의 기준일이
 *   이 값에서 파생되므로, 늦게 처리할 때 실제 시행일을 넘기면 "매월 1일" 같은 규칙이 처리한 날로
 *   밀리지 않는다. (단말 시간대와 무관하게 KST 달력 날짜를 쓴다 — 앱 전반의 날짜 처리와 동일)
 */
export async function completeCareToday(
  supabase: SupabaseClient,
  item: CompletableCareItem,
  eventOn: string = todayKST(),
): Promise<{ error: string | null }> {
  const rule = parseRule(item.recur_rule ?? null)
  const next = rule ? nextOccurrence(rule, parseYMD(eventOn), parseYMD(eventOn)) : null
  const { error } = await supabase.from('records').insert({
    pet_id: item.pet_id,
    category: item.category,
    title: item.title,
    event_on: eventOn,
    recur_rule: item.recur_rule ?? null,
    next_due_on: next ? ymd(next) : null,
  })
  return { error: error ? error.message : null }
}

/**
 * '산책했어요' 수동 기록 — GPS 추적 없이 오늘 산책을 한 건 남긴다.
 * '오늘의 돌봄 체크'에서 (이미 산책을 마친 뒤) 체크만 하고 싶을 때 쓴다. 거리·시간은 미측정이라
 * 0 으로 두고 비공개로 저장한다(거리 통계 왜곡 없음, 공개 피드에 노출되지 않음). walks 테이블에
 * 남으므로 '오늘 산책 여부'·주간 산책 횟수 판정과 일관된다.
 */
export async function logManualWalk(
  supabase: SupabaseClient,
  petId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }
  const now = new Date().toISOString()
  const { error } = await supabase.from('walks').insert({
    user_id: user.id,
    pet_id: petId,
    started_at: now,
    ended_at: now,
    duration_s: 0,
    distance_m: 0,
    is_public: false,
  })
  return { error: error ? error.message : null }
}

/**
 * 원탭 생활기록(밥·물·배변·투약 등)을 "지금 시각"으로 한 건 추가한다.
 * QuickLogBar 와 오늘의 돌봄 체크가 공유하는 단일 입력 경로(중복 방지).
 * @returns id(성공 시 생성된 기록 id) · at(기록 시각 Date) · error(실패 메시지)
 */
export async function logDailyRecord(
  supabase: SupabaseClient,
  petId: string,
  category: RecordCategory | string,
  title?: string,
): Promise<{ id: string | null; at: Date; error: string | null }> {
  const now = new Date()
  const { data, error } = await supabase
    .from('records')
    .insert({
      pet_id: petId,
      category,
      title: title ?? String(category),
      event_on: todayKST(),
      event_at: now.toISOString(),
    })
    .select('id')
    .single()
  return { id: (data?.id as string) ?? null, at: now, error: error ? error.message : null }
}

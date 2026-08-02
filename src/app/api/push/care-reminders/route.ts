import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { careCategoryIcon, daysUntil } from '@/lib/utils'
import { cronAuthError, kstDate } from '@/lib/cron'
import { computeUpcoming, type ScheduleRow } from '@/lib/schedule'
import type { RecordCategory } from '@/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 건강 일정 D-day 리마인더 (Vercel Cron 일일 호출용).
 * 오늘~내일(D-day, D-1) 예정 건강 기록의 보호자에게 푸시.
 * CRON_SECRET 으로 보호. 같은 날 중복 발송은 last_reminded_on 으로 방지.
 */
export async function GET(req: Request) {
  // Vercel Cron은 CRON_SECRET이 설정되면 Authorization: Bearer <secret> 헤더를 보냄
  const authErr = cronAuthError(req, 'care-reminders')
  if (authErr) return authErr

  // 기록의 날짜(next_due_on 등)는 작성자 브라우저의 로컬(KST) 달력 날짜로 저장된다.
  // 서버 cron은 UTC로 동작하므로, 시차로 D-day가 하루 어긋나지 않도록 KST 기준 오늘/내일을 계산한다.
  const today = kstDate(0)
  const tomorrow = kstDate(1)
  // 테스트용: ?force=1 이면 당일 중복 방지(last_reminded_on)를 무시하고 재발송
  const force = new URL(req.url).searchParams.get('force') === '1'

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  }

  // 1단계 — 후보 반려동물 추리기: (1) next_due_on 이 오늘~내일인 일반(비반복) 기록 또는
  // (2) 반복 규칙이 있는 기록을 가진 반려동물. 반복 기록의 next_due_on 은 생성 시점 값에 고정돼
  // 있어(완료 탭 전까지 갱신 안 됨) 정적 범위 필터로는 두 번째 발생부터 빠진다 — 앱 화면은
  // event_on+recur_rule 로 다음 발생일을 굴려서 계속 보여주므로 반복 기록은 모두 후보로 본다.
  const { data: candidates, error: candErr } = await admin
    .from('records')
    .select('pet_id')
    .or(`and(next_due_on.gte.${today},next_due_on.lte.${tomorrow}),recur_rule.not.is.null`)

  if (candErr) {
    console.error('[care-reminders] candidate select error:', candErr)
    return NextResponse.json({ error: candErr.message }, { status: 500 })
  }

  const candidatePetIds = Array.from(new Set((candidates ?? []).map(c => c.pet_id as string)))
  if (candidatePetIds.length === 0) {
    const result = { processed: 0, sent: 0, force }
    console.log('[care-reminders]', JSON.stringify(result))
    return NextResponse.json(result)
  }

  // 2단계 — 후보 반려동물의 '모든' 기록을 받아 라인별 최신 기록을 정확히 판정한다.
  // (후보 조회만으로 계산하면, 최근에 처리된 비반복 1회성 기록이 오늘~내일 창 밖이라 빠져서
  //  같은 라인의 오래된 반복 기록이 '최신'으로 오인 → 이미 처리된 일정에 리마인더가 잘못 나갈 수
  //  있다. 앱 화면(computeUpcoming)은 전체 기록을 읽으므로 리마인더도 동일 기준을 쓴다.)
  const { data, error } = await admin
    .from('records')
    .select('id, pet_id, category, title, event_on, next_due_on, recur_rule, last_reminded_on, created_at, pet:pets(user_id, name)')
    .in('pet_id', candidatePetIds)

  if (error) {
    console.error('[care-reminders] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    pet_id: string
    category: RecordCategory
    title: string
    event_on: string
    next_due_on: string | null
    recur_rule: string | null
    last_reminded_on: string | null
    created_at: string | null
    pet: { user_id: string; name: string } | null
  }
  const allRows = (data ?? []) as unknown as Row[]

  // 앱 화면과 동일한 단일 출처(computeUpcoming)로 "항목 라인별 최신 기록 → 활성 다음 예정일"을
  // 계산한다. 반복은 event_on+recur_rule 로 굴러간 실제 다음 발생일이 나온다. 그중 오늘/내일
  // 예정인 라인만 발송 대상으로 삼는다. (라인별 최신 1건으로 자동 중복 제거 → 라인당 1회 알림)
  const rowById = new Map(allRows.map(r => [r.id, r]))
  // computeUpcoming/latestRecordPerLine 은 입력이 event_on 내림차순(최신 우선)임을 전제한다.
  // DB 조회 순서를 신뢰하지 말고 여기서 정렬해 라인별 '최신 기록'이 올바로 선택되게 한다.
  // 같은 event_on 동점 시 created_at 내림차순으로 2차 정렬 — 일정 화면(schedule/page.tsx)이
  // 쓰는 정렬과 동일하게 맞춰, 같은 날 여러 기록이 있어도 리마인더가 화면과 같은 '최신 기록'
  // (=올바른 recur_rule/last_reminded_on)을 대표로 골라 중복·누락 발송을 막는다.
  const scheduleRows: ScheduleRow[] = allRows
    .slice()
    .sort((a, b) =>
      b.event_on.localeCompare(a.event_on) ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map(r => ({
      id: r.id, pet_id: r.pet_id, category: r.category, title: r.title,
      event_on: r.event_on, next_due_on: r.next_due_on, recur_rule: r.recur_rule,
    }))
  const rows = computeUpcoming(scheduleRows)
    .filter(it => it.next_due_on === today || it.next_due_on === tomorrow)
    // force가 아니면 오늘 이미 리마인드한 라인은 제외(당일 중복 방지). 라인의 대표는 최신 기록.
    .filter(it => {
      if (force) return true
      const rem = rowById.get(it.record_id)?.last_reminded_on
      return !rem || rem < today
    })
    .map(it => ({
      id: it.record_id,
      pet_id: it.pet_id,
      category: it.category,
      title: it.title,
      last_on: it.last_on,
      next_due_on: it.next_due_on,
      pet: rowById.get(it.record_id)?.pet ?? null,
    }))

  // 공동 관리자(pet_members)에게도 발송하기 위해 반려동물별 구성원 user_id를 조회한다.
  // (소유자뿐 아니라 함께 돌보는 가족 전원이 D-day 알림을 받도록)
  const petIds = Array.from(new Set(rows.map(r => r.pet_id)))
  const membersByPet = new Map<string, string[]>()
  if (petIds.length > 0) {
    const { data: members } = await admin
      .from('pet_members')
      .select('pet_id, user_id')
      .in('pet_id', petIds)
    for (const m of (members ?? []) as { pet_id: string; user_id: string }[]) {
      const list = membersByPet.get(m.pet_id) ?? []
      list.push(m.user_id)
      membersByPet.set(m.pet_id, list)
    }
  }

  let sent = 0
  for (const r of rows) {
    // 구성원 목록이 없으면(예외) 소유자에게 폴백
    const recipients = membersByPet.get(r.pet_id) ?? (r.pet?.user_id ? [r.pet.user_id] : [])
    if (recipients.length === 0) continue
    const petName = r.pet?.name ?? ''
    // 케어 톤 문구: D-day 대신 "오늘/내일 예정 + 마지막 시행 N일 전"으로, 사용자가 바로
    // "아, 우리 아이 이제 챙겨야겠다"고 인지하게 한다.
    const due = daysUntil(r.next_due_on, today)      // 0=오늘, 1=내일 (발송 대상이 이 둘뿐)
    const since = Math.max(0, -daysUntil(r.last_on, today))
    const whenTxt = due <= 0 ? '오늘' : '내일'
    const sinceTxt = since > 0 ? ` · 마지막 시행 ${since}일 전` : ''
    for (const uid of recipients) {
      await sendPushToUser(uid, {
        title: `${careCategoryIcon(r.category)} ${petName} · ${r.category} 챙길 시간이에요`,
        body: `${whenTxt} ${r.title} 예정이에요${sinceTxt}`,
        url: '/schedule',
        tag: `care-${r.id}`,
      })
      sent++
    }
    // 당일 중복 발송 방지 플래그. 갱신 실패 시 다음 cron에서 같은 사용자에게 중복 푸시가
    // 갈 수 있으므로 조용히 넘기지 않고 로그로 남긴다.
    const { error: markErr } = await admin
      .from('records').update({ last_reminded_on: today }).eq('id', r.id)
    if (markErr) console.error('[care-reminders] last_reminded_on update failed', r.id, markErr.message)
  }

  const result = { processed: rows.length, sent, force }
  console.log('[care-reminders]', JSON.stringify(result))
  return NextResponse.json(result)
}

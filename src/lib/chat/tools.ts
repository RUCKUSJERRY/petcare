import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordCategory } from '@/types'
import { RECORD_CATEGORIES, DAILY_LOG_SET } from '@/lib/records'
import { logManualWalk } from '@/lib/careActions'
import { todayKST } from '@/lib/utils'

export type ChatToolPet = { id: string; name: string }

/**
 * 챗봇이 실제 앱 기능을 실행하는 도구(액션) 모음. (3단계)
 * 사용자의 supabase 세션으로 동작하므로 RLS 로 본인 데이터만 쓴다.
 * 도구가 실제로 실행돼 결과를 받은 뒤에만 모델이 "기록했다"고 답하도록 시스템 프롬프트로 강제한다.
 */
export function buildChatTools(supabase: SupabaseClient, pets: ChatToolPet[]) {
  const resolvePet = (petName?: string): { pet: ChatToolPet } | { error: string } => {
    if (pets.length === 0) return { error: '등록된 반려동물이 없어요. 먼저 아이를 등록해 주세요.' }
    if (!petName) {
      if (pets.length === 1) return { pet: pets[0] }
      return { error: `어느 아이의 기록인지 알려주세요: ${pets.map(p => p.name).join(', ')}` }
    }
    const q = petName.trim().toLowerCase()
    const found =
      pets.find(p => p.name.toLowerCase() === q) ||
      pets.find(p => p.name.toLowerCase().includes(q))
    if (found) return { pet: found }
    if (pets.length === 1) return { pet: pets[0] }
    return { error: `'${petName}' 아이를 찾지 못했어요. (등록된 아이: ${pets.map(p => p.name).join(', ')})` }
  }

  const CATSET = new Set<string>(RECORD_CATEGORIES as unknown as string[])

  return {
    addRecord: tool({
      description:
        '반려동물의 생활·케어 기록을 실제로 저장한다(식사·간식·물·배변·투약·양치·목욕·미용·발톱·귀청소·진료·접종·구충·건강검진 등). ' +
        '사용자가 기록을 요청하면 반드시 이 도구를 호출해 저장하고, 성공 결과를 받은 뒤에만 저장 완료를 안내한다.',
      inputSchema: z.object({
        petName: z.string().optional().describe('반려동물 이름. 아이가 한 마리뿐이면 생략 가능'),
        category: z.string().describe('기록 종류. 예: 식사, 물, 배변, 간식, 투약, 양치, 진료'),
        date: z.string().optional().describe('시행일 YYYY-MM-DD. 생략하면 오늘'),
        time: z.string().optional().describe('시각 HH:MM(24시간). 생략 가능'),
        memo: z.string().optional().describe('메모/상세(급여량·특이사항 등)'),
      }),
      execute: async ({ petName, category, date, time, memo }) => {
        const r = resolvePet(petName)
        if ('error' in r) return { ok: false, message: r.error }
        const cat: string = CATSET.has(category)
          ? category
          : /사료|밥|먹이/.test(category) ? '식사' : '기타'
        const eventOn = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : todayKST()
        let eventAt: string | null = null
        if (time && /^\d{1,2}:\d{2}$/.test(time)) {
          const [h, m] = time.split(':')
          eventAt = `${eventOn}T${h.padStart(2, '0')}:${m}:00+09:00`
        } else if (DAILY_LOG_SET.has(cat as RecordCategory)) {
          eventAt = eventOn === todayKST() ? new Date().toISOString() : `${eventOn}T09:00:00+09:00`
        }
        const { error } = await supabase.from('records').insert({
          pet_id: r.pet.id,
          category: cat,
          title: cat,
          event_on: eventOn,
          event_at: eventAt,
          memo: memo ?? null,
        })
        if (error) return { ok: false, message: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' }
        return { ok: true, petName: r.pet.name, category: cat, date: eventOn, time: time ?? null, memo: memo ?? null }
      },
    }),

    logWalk: tool({
      description: '반려동물의 산책을 오늘 다녀온 것으로 기록한다(GPS 없이 기록만). 사용자가 산책 기록을 요청할 때 호출.',
      inputSchema: z.object({
        petName: z.string().optional().describe('반려동물 이름. 아이가 한 마리뿐이면 생략 가능'),
      }),
      execute: async ({ petName }) => {
        const r = resolvePet(petName)
        if ('error' in r) return { ok: false, message: r.error }
        const { error } = await logManualWalk(supabase, r.pet.id)
        if (error) return { ok: false, message: '산책 기록에 실패했어요.' }
        return { ok: true, petName: r.pet.name }
      },
    }),
  }
}

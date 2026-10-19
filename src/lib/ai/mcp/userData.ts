import type { SupabaseClient } from '@supabase/supabase-js'
import { summarizeWalks, type WalkLike } from '@/lib/walkStats'
import { aggregateCostStats, type CostRecord } from '@/lib/costStats'
import { computeUpcoming, type ScheduleRow } from '@/lib/schedule'
import { formatWalkSummary, formatCostStats, formatUpcoming } from '@/lib/chat/readTools'
import { todayKST } from '@/lib/utils'

/**
 * MCP 사용자 데이터 접근 (service role, 그러나 '토큰 주인'의 데이터로만 엄격히 범위 제한).
 *
 * MCP 요청은 로그인 세션이 없어 RLS 가 걸리지 않으므로, 여기서 모든 조회를 토큰 주인이 구성원인
 * 반려동물(pet_members)로 직접 제한한다. 이 범위 밖 데이터는 절대 반환하지 않는다(타 사용자 격리).
 * 집계/표시는 챗봇과 같은 테스트된 lib·포매터를 재사용한다.
 */

export interface McpUserContext {
  userId: string
  admin: SupabaseClient
}

interface Pet { id: string; name: string }

/** 토큰 주인이 구성원인 반려동물 목록(범위의 단일 출처). */
async function myPets(ctx: McpUserContext): Promise<Pet[]> {
  const { data: members } = await ctx.admin.from('pet_members').select('pet_id').eq('user_id', ctx.userId)
  const ids = (members ?? []).map(m => (m as { pet_id: string }).pet_id)
  if (ids.length === 0) return []
  const { data: pets } = await ctx.admin.from('pets').select('id, name').in('id', ids)
  return (pets ?? []) as Pet[]
}

/** 이름으로 반려동물 1마리 특정(없거나 모호하면 안내 메시지). */
function resolvePet(pets: Pet[], petName?: string): Pet | { error: string } {
  if (pets.length === 0) return { error: '등록된 반려동물이 없어요.' }
  if (!petName) {
    if (pets.length === 1) return pets[0]
    return { error: `어느 아이인지 알려주세요: ${pets.map(p => p.name).join(', ')}` }
  }
  const q = petName.trim().toLowerCase()
  const hit = pets.find(p => p.name.toLowerCase() === q) || pets.find(p => p.name.toLowerCase().includes(q))
  if (hit) return hit
  if (pets.length === 1) return pets[0]
  return { error: `'${petName}' 아이를 찾지 못했어요. (등록: ${pets.map(p => p.name).join(', ')})` }
}

export async function myPetsText(ctx: McpUserContext): Promise<string> {
  const pets = await myPets(ctx)
  if (pets.length === 0) return '등록된 반려동물이 없어요.'
  return `내 반려동물: ${pets.map(p => p.name).join(', ')}`
}

export async function myWalkSummaryText(ctx: McpUserContext, petName?: string): Promise<string> {
  const pet = resolvePet(await myPets(ctx), petName)
  if ('error' in pet) return pet.error
  const { data } = await ctx.admin.from('walks').select('started_at, distance_m, duration_s').eq('pet_id', pet.id)
  return formatWalkSummary(pet.name, summarizeWalks((data ?? []) as WalkLike[]))
}

export async function myCostsText(ctx: McpUserContext, petName?: string, year?: number): Promise<string> {
  const pet = resolvePet(await myPets(ctx), petName)
  if ('error' in pet) return pet.error
  const today = todayKST()
  const yr = Number.isInteger(year) ? (year as number) : Number(today.slice(0, 4))
  const { data } = await ctx.admin.from('records').select('category, event_on, cost').eq('pet_id', pet.id).not('cost', 'is', null)
  return formatCostStats(pet.name, aggregateCostStats((data ?? []) as CostRecord[], yr, today))
}

export async function myUpcomingCareText(ctx: McpUserContext, petName?: string): Promise<string> {
  const pet = resolvePet(await myPets(ctx), petName)
  if ('error' in pet) return pet.error
  const { data } = await ctx.admin.from('records')
    .select('id, pet_id, category, title, event_on, next_due_on, recur_rule, created_at')
    .eq('pet_id', pet.id)
    .order('event_on', { ascending: false }).order('created_at', { ascending: false })
  const rows = (data ?? []) as (ScheduleRow & { created_at: string })[]
  return formatUpcoming(pet.name, computeUpcoming(rows), todayKST())
}

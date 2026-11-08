'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { todayKST, isoToKstDate, careCategoryIcon } from '@/lib/utils'
import { candidateMemoryDates, kstDayRanges, selectMemories, type Memory, type MemorySource } from '@/lib/memories'

/**
 * 홈 '추억 다시보기' 카드 — 과거에 남긴 기록/산책 중 '오늘과 같은 날짜'(지난 해들의 같은 월/일,
 * 또는 같은 날짜의 지난 달들)를 "N년 전 오늘 / N개월 전 오늘" 로 다시 꺼내 보여준다.
 *
 * 쌓인 기록을 정서적으로 되살려(사진·메모 우선) 재방문·체류 동기를 더하는 리텐션 카드.
 * 선택된 아이 기준으로 조회하며, 되살릴 추억이 없으면 렌더하지 않아 홈을 번잡하게 하지 않는다.
 * 선택/라벨 판정은 전부 순수 lib(memories.ts)에서 결정적으로 계산·테스트된다.
 */
export function MemoriesCard() {
  const t = useTranslations('memories')
  const supabase = createClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null
  const today = todayKST()

  const { data: memories } = useQuery({
    queryKey: ['memories', selectedPetId, today],
    enabled: !!selectedPetId,
    // 하루 단위로만 바뀌는 콘텐츠라 자주 다시 읽을 필요가 없다.
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const dates = candidateMemoryDates(today)
      if (dates.length === 0) return []
      // 산책(started_at timestamptz)을 후보 KST 날짜의 하루 범위로 정확히 거르는 or 조건.
      // '가장 최근 N건'으로 받으면 산책이 많은 사용자의 옛 추억이 전혀 안 걸린다(핵심 버그).
      const walkOr = kstDayRanges(dates)
        .map(r => `and(started_at.gte.${r.gte},started_at.lt.${r.lt})`)
        .join(',')
      // 기록: '그날의 오늘' 후보 날짜에 정확히 걸리는 것만 가볍게 조회(.in).
      // 산책: 사진이 있는 것(정서적 추억)만, 후보 날짜 범위로 걸러 받는다.
      const [recRes, walkRes] = await Promise.all([
        supabase
          .from('records')
          .select('id, category, title, event_on, memo, place_name, photo_url, photo_urls')
          .eq('pet_id', selectedPetId!)
          .in('event_on', dates),
        supabase
          .from('walks')
          .select('id, title, started_at, note, area_text, photo_url')
          .eq('pet_id', selectedPetId!)
          .not('photo_url', 'is', null)
          .or(walkOr)
          .limit(200),
      ])

      const recSources: MemorySource[] = ((recRes.data ?? []) as {
        id: string; category: string; title: string; event_on: string
        memo: string | null; place_name: string | null; photo_url: string | null; photo_urls: string[] | null
      }[]).map(r => ({
        id: r.id,
        kind: 'record',
        dateStr: r.event_on,
        title: r.title || r.category,
        category: r.category,
        memo: r.memo,
        placeName: r.place_name,
        photoUrl: r.photo_url ?? (r.photo_urls && r.photo_urls[0]) ?? null,
      }))

      const walkSources: MemorySource[] = ((walkRes.data ?? []) as {
        id: string; title: string | null; started_at: string; note: string | null
        area_text: string | null; photo_url: string | null
      }[]).map(w => ({
        id: w.id,
        kind: 'walk',
        dateStr: isoToKstDate(w.started_at),
        title: w.title || t('walkTitle'),
        memo: w.note,
        placeName: w.area_text,
        photoUrl: w.photo_url,
      }))

      return selectMemories([...recSources, ...walkSources], today)
    },
  })

  if (!pet || !memories || memories.length === 0) return null

  return (
    <div className="card space-y-3">
      <div className="min-w-0">
        <h2 className="font-bold text-gray-900">📸 {t('title')}</h2>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{t('subtitle', { name: pet.name })}</p>
      </div>

      {/* 가로 스크롤 추억 타일 — 사진/메모가 있는 가장 정서적인 추억부터 */}
      <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
        {memories.map(m => (
          <MemoryTile key={`${m.kind}-${m.id}`} memory={m} petId={pet.id} label={labelFor(m, t)} />
        ))}
      </div>
    </div>
  )
}

/** 'N년 전 오늘' / 'N개월 전 오늘' 라벨 — 숫자는 lib 에서, 문구는 i18n 으로 조립(ko.json). */
function labelFor(m: Memory, t: ReturnType<typeof useTranslations>): string {
  return m.yearsAgo >= 1 ? t('yearsAgo', { years: m.yearsAgo }) : t('monthsAgo', { months: m.monthsAgo })
}

function MemoryTile({ memory, petId, label }: { memory: Memory; petId: string; label: string }) {
  // 산책은 산책 상세로, 기록은 아이 상세의 그 기록 상세 모달로 바로 연다(?record=id).
  // (추억 타일을 눌렀을 때 범용 프로필이 아니라 '그 추억'이 다시 보이게 — 리텐션 카드의 보상.)
  const href = memory.kind === 'walk' ? `/walks/${memory.id}` : `/pets/${petId}?record=${memory.id}`
  const icon = memory.category ? careCategoryIcon(memory.category) : '🦮'
  const caption = (memory.memo && memory.memo.trim()) || memory.placeName || memory.title

  return (
    <Link
      href={href}
      className="group shrink-0 w-36 snap-start rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-primary-50 flex items-center justify-center">
        {memory.photoUrl ? (
          // 프로젝트 전역과 동일하게 일반 img 사용(Supabase 공개 스토리지 URL).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={memory.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl" aria-hidden>{icon}</span>
        )}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white bg-black/55 rounded-full px-2 py-0.5">
          {label}
        </span>
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-gray-800 truncate">
          <span aria-hidden>{icon}</span> {memory.title}
        </p>
        {caption !== memory.title && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{caption}</p>
        )}
      </div>
    </Link>
  )
}

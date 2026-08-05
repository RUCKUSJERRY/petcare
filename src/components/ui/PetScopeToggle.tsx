'use client'

import { useTranslations } from 'next-intl'
import { PetAvatar } from './PetAvatar'
import type { Species } from '@/types'

/**
 * '이 아이 / 전체' 보기 범위 세그먼트 토글 — 여러 아이를 키우는 보호자가 한 아이 기준과
 * 모든 아이 합산 보기를 오갈 수 있게 한다.
 *
 * 배경: 상단 헤더의 아이 칩은 항상 한 아이를 '선택'만 하고 해제가 없어(홈이 빈 화면처럼 보이던
 * 문제로 의도적으로 제거됨), 비용·일정의 '전체 합산' 보기에 도달할 방법이 사라져 있었다.
 * 헤더 선택 자체는 건드리지 않고, 이 토글로 화면 안에서만 보기 범위를 전환한다.
 *
 * 아이가 1마리뿐이면 '전체'와 '이 아이'가 같으므로 호출부에서 렌더하지 않는다(토글 무의미).
 */
export function PetScopeToggle({
  showAll,
  onChange,
  petName,
  petSpecies,
  petPhotoUrl,
}: {
  showAll: boolean
  onChange: (showAll: boolean) => void
  petName: string
  petSpecies: Species
  petPhotoUrl?: string | null
}) {
  const tc = useTranslations('common')

  return (
    <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs font-semibold shrink-0">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!showAll}
        aria-label={tc('scopeThisAria', { name: petName })}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
          !showAll ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
        }`}
      >
        <PetAvatar photoUrl={petPhotoUrl} species={petSpecies} className="w-4 h-4" emojiClassName="text-sm leading-none" />
        <span className="max-w-[5rem] truncate">{petName}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={showAll}
        aria-label={tc('scopeAllAria')}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          showAll ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
        }`}
      >
        {tc('scopeAll')}
      </button>
    </div>
  )
}

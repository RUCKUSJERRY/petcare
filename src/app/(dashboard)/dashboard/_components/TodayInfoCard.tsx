'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { calcPetAge, cn, stageLabel, todayKST } from '@/lib/utils'
import { healthChecklistFor } from '@/lib/healthChecklist'
import { getDailyTip } from '@/lib/dailyTip'

/** 날짜 문자열(YYYY-MM-DD)을 '에포크 이후 일수'로 — 매일 다른 항목을 결정적으로 고르기 위함 */
function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * 홈 '오늘의 정보' 통합 카드.
 *
 * 예전엔 '오늘의 건강 포인트'와 '오늘의 케어 팁'이 별도 카드로 연달아 쌓여 있었다. 둘 다
 * "매일 바뀌는 한 줄 정보 → 정보 화면으로 링크"로 성격이 사실상 같아 중복감을 주고 홈 스크롤을
 * 늘렸다. 하나의 카드에서 세그먼트(건강 ↔ 케어 팁)로 전환하도록 합쳐 스크롤을 줄이고 중복을
 * 없애되, 두 정보의 노출은 그대로 유지한다(정보 고도화·발견성 유지).
 *
 * 두 콘텐츠 모두 정적/결정적 데이터(healthChecklist·dailyTip)에서 날짜로 뽑으므로 클라이언트에서
 * 계산해도 동일하게 재현된다. 선택된 아이가 없으면 아무것도 렌더링하지 않는다.
 */
export function TodayInfoCard() {
  const t = useTranslations('dashboard')
  const tTip = useTranslations('dailyTip')
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null
  const [tab, setTab] = useState<'health' | 'tip'>('health')
  if (!pet) return null

  const today = todayKST()
  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
  const stage = stageLabel(age)
  const checklist = healthChecklistFor(pet.species, stage)
  const healthItem = checklist.items.length
    ? checklist.items[dayNumber(today) % checklist.items.length]
    : null
  // 오늘의 팁도 종뿐 아니라 생애단계(나이대)에 맞춰 고른다(정보 고도화 — 나이 맞춤).
  const tip = getDailyTip(pet.species, today, stage)

  // 둘 다 없으면(방어적) 렌더링하지 않는다.
  if (!healthItem && !tip) return null

  // 한쪽만 있으면 세그먼트 없이 그 하나만 보여준다.
  const both = !!healthItem && !!tip
  const active: 'health' | 'tip' = both ? tab : (healthItem ? 'health' : 'tip')

  return (
    <div className="card space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        {both ? (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5" role="tablist" aria-label={t('todayInfoTitle')}>
            {([['health', t('todayInfoHealthTab')], ['tip', t('todayInfoTipTab')]] as const).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                aria-selected={active === v}
                onClick={() => setTab(v)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-semibold transition-colors',
                  active === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-gray-500">
            {active === 'health' ? t('healthPointTitle') : tTip('title')}
          </h2>
        )}
        <Link
          href={active === 'health' ? '/health' : (tip?.href ?? '/foods')}
          className="text-xs text-gray-400 font-medium shrink-0"
        >
          {active === 'health' ? t('healthPointMore') : (tip?.category ?? '')} ›
        </Link>
      </div>

      {active === 'health' && healthItem && (
        <Link href="/health" className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>{healthItem.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{healthItem.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{healthItem.detail}</p>
          </div>
        </Link>
      )}

      {active === 'tip' && tip && (
        <Link href={tip.href} className="flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>{tip.icon}</span>
          <p className="flex-1 text-sm text-gray-700 leading-relaxed">{tip.text}</p>
        </Link>
      )}
    </div>
  )
}

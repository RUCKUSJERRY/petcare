'use client'

import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, careCategoryIcon, ddayBadge, lifeStageColor, nextAnniversary, daysTogether, daysUntil } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { QuickLogBar } from '@/app/(dashboard)/pets/_components/QuickLogBar'
import type { CareAlert, Pet } from '@/types'

// 맞춤 '가이드' 바로가기 (기록과 구분되도록 라벨 명확화)
const QUICK_LINKS = [
  { href: '/foods', emoji: '🥩', key: 'guideFood' as const },
  { href: '/health', emoji: '🩺', key: 'guideHealth' as const },
  { href: '/walk', emoji: '🎾', key: 'guideActivity' as const },
  { href: '/care', emoji: '🧼', key: 'guideLife' as const },
]

/**
 * 헤더에서 선택한 아이의 요약 카드.
 * 선택된 아이가 없으면 아무것도 렌더링하지 않는다.
 */
export function SelectedPetSummary({
  pets,
  vaccAlerts,
}: {
  pets: Pet[]
  vaccAlerts: CareAlert[]
}) {
  const { selectedPetId } = useSelectedPet()
  const t = useTranslations('summary')
  if (!selectedPetId) return null

  const pet = pets.find(p => p.id === selectedPetId)
  if (!pet) return null

  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
  // 30일 이내 다가오는 생일 배지 + 함께한 날수
  const nextBirthday = nextAnniversary(pet.birth_month, pet.birth_day)
  const birthdayUpcoming = nextBirthday && daysUntil(nextBirthday) <= 30
  const together = daysTogether(pet.adopted_on)
  const nextVacc = vaccAlerts
    .filter(v => v.pet_id === pet.id)
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))[0]

  return (
    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
          {pet.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
          ) : (pet.species === 'cat' ? '🐱' : '🐶')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold truncate">{pet.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
              {age.lifeStage}
            </span>
          </div>
          <p className="text-sm text-white/80 mt-0.5 truncate">
            {pet.breed?.name_ko} · {age.displayText}
          </p>
          {(birthdayUpcoming || together != null) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {birthdayUpcoming && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                  {t('birthdayBadge', { dday: ddayBadge(nextBirthday!).text })}
                </span>
              )}
              {together != null && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                  {t('together', { days: together })}
                </span>
              )}
            </div>
          )}
        </div>
        <Link
          href={`/pets/${pet.id}`}
          className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 font-medium shrink-0 transition-colors"
        >
          {t('detail')}
        </Link>
      </div>

      {/* 다음 건강 일정 알림 — 누르면 일정 화면(해당 날짜)으로 진입 */}
      {nextVacc && (
        <Link
          href={`/schedule?focus=${nextVacc.next_due_on}&pet=${pet.id}`}
          className="mt-3 flex items-center gap-2 bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <span aria-hidden>{careCategoryIcon(nextVacc.category)}</span>
          <span className="flex-1 truncate">{nextVacc.title}</span>
          <span className="text-xs font-semibold text-white/90 shrink-0">
            {ddayBadge(nextVacc.next_due_on).text}
          </span>
          <span aria-hidden className="text-white/60">›</span>
        </Link>
      )}

      {/* 빠른 '기록' 입력 (아이 상세의 해당 폼/스캔을 바로 열어줌) */}
      <p className="mt-3 mb-1.5 text-xs font-semibold text-white/70">{t('recordSection')}</p>
      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/pets/${pet.id}?add=weight`}
          className="flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          <span aria-hidden>⚖️</span> {t('weight')}
        </Link>
        <Link
          href={`/schedule?pet=${pet.id}&add=1`}
          className="flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          <span aria-hidden>📝</span> {t('record')}
        </Link>
        <Link
          href={`/schedule?pet=${pet.id}&scan=1`}
          className="flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          <span aria-hidden>📷</span> {t('scan')}
        </Link>
      </div>

      {/* 오늘의 기록 — 육아앱식 원탭 생활기록(식사·배변·투약 등) */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/70">{t('todayLogSection')}</p>
        <Link href={`/schedule?pet=${pet.id}&view=today`} className="text-xs text-white/70 hover:text-white">
          {t('detail')} ›
        </Link>
      </div>
      <div className="mt-1.5">
        <QuickLogBar petId={pet.id} tone="onPrimary" />
      </div>

      {/* 맞춤 '가이드' 바로가기 (선택된 아이 기준으로 필터됨) — 기록과 구분 */}
      <p className="mt-3 mb-1.5 text-xs font-semibold text-white/70">{t('guideSection')}</p>
      <div className="grid grid-cols-4 gap-2">
        {QUICK_LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col items-center gap-0.5 bg-white/15 hover:bg-white/25 rounded-lg py-2.5 transition-colors"
          >
            <span className="text-lg leading-none">{l.emoji}</span>
            <span className="text-xs font-medium">{t(l.key)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

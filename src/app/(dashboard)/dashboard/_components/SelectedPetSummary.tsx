'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, careCategoryIcon, ddayBadge, lifeStageColor, stageLabel, nextAnniversary, daysTogether, togetherMilestone, daysUntil, todayKST } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { QuickLogBar } from '@/app/(dashboard)/pets/_components/QuickLogBar'
import { RecordFeed } from '@/app/(dashboard)/pets/_components/RecordFeed'
import { RecordDetailModal } from '@/app/(dashboard)/pets/_components/RecordDetailModal'
import { RecordFormModal } from '@/app/(dashboard)/pets/_components/RecordFormModal'
import { RecordsScanModal } from '@/app/(dashboard)/pets/_components/RecordsScanModal'
import { WeightSection } from '@/app/(dashboard)/pets/_components/WeightSection'
import { PetAvatar } from '@/components/ui/PetAvatar'
import type { CareAlert, Pet } from '@/types'

/**
 * 헤더에서 선택한 아이의 요약 카드.
 * 선택된 아이가 없으면 아무것도 렌더링하지 않는다.
 */
export function SelectedPetSummary({
  pets,
  vaccAlerts,
  streakByPet = {},
}: {
  pets: Pet[]
  vaccAlerts: CareAlert[]
  /** 아이별 생활기록 연속일 — 🔥 배지로 재방문·기록 습관을 유도 */
  streakByPet?: Record<string, number>
}) {
  const { selectedPetId } = useSelectedPet()
  const t = useTranslations('summary')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  // 상세 입력(체중·직접·스캔)은 페이지 이동 대신 현재 홈 화면 위 모달로 연다 → 저장 후 원래 자리로 복귀.
  // (QuickRecordFab 과 동일 패턴 — 앱 전반의 기록 진입을 일관되게)
  const [modal, setModal] = useState<null | 'weight' | 'manual' | 'scan'>(null)
  if (!selectedPetId) return null

  const pet = pets.find(p => p.id === selectedPetId)
  if (!pet) return null

  const afterRecord = () => {
    qc.invalidateQueries({ queryKey: ['today-timeline', pet.id] })
    qc.invalidateQueries({ queryKey: ['record-feed', pet.id] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)
  // D-day 계산은 KST '오늘' 기준으로 통일한다. (인자를 비우면 기기 로컬 시간대로 계산돼,
  // KST 달력 기준인 서버 대시보드 알림과 자정 부근에서 하루 어긋난다.)
  const today = todayKST()
  // 30일 이내 다가오는 생일 배지 + 함께한 날수
  const nextBirthday = nextAnniversary(pet.birth_month, pet.birth_day)
  const birthdayUpcoming = nextBirthday && daysUntil(nextBirthday, today) <= 30
  const together = daysTogether(pet.adopted_on)
  // 함께한 지 100·200·300…일이 다가오면(또는 오늘이면) 축하 배지로 정서적 재방문 계기를 준다.
  const milestone = togetherMilestone(together)
  // 생활기록 연속일 — 2일 이상일 때만 🔥 배지로 강조(1일은 동기부여 약함). 매일 기록 습관을 유도.
  const streak = streakByPet[pet.id] ?? 0
  const nextVacc = vaccAlerts
    .filter(v => v.pet_id === pet.id)
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))[0]

  return (
    <>
    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <PetAvatar photoUrl={pet.photo_url} species={pet.species} name={pet.name}
          className="w-16 h-16 bg-white/20" emojiClassName="text-3xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold truncate">{pet.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(stageLabel(age))}`}>
              {stageLabel(age)}
            </span>
          </div>
          <p className="text-sm text-white/80 mt-0.5 truncate">
            {[pet.breed?.name_ko, age.displayText].filter(Boolean).join(' · ')}
          </p>
          {(birthdayUpcoming || together != null || milestone || streak >= 2) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {/* 연속 기록일 — 따뜻한 앰버 톤 '불꽃' 배지로 다른 칩과 구분해 눈에 띄게 */}
              {streak >= 2 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-300 text-amber-900 font-bold">
                  {t('streakBadge', { days: streak })}
                </span>
              )}
              {birthdayUpcoming && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                  {t('birthdayBadge', { dday: ddayBadge(nextBirthday!, today).text })}
                </span>
              )}
              {/* 함께한 날 이정표 축하 배지 — 밝게 강조해 눈에 띄게 */}
              {milestone && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-primary-700 font-bold">
                  {milestone.dday === 0
                    ? t('milestoneToday', { days: milestone.milestone })
                    : t('milestoneDday', { days: milestone.milestone, dday: milestone.dday })}
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
            {ddayBadge(nextVacc.next_due_on, today).text}
          </span>
          <span aria-hidden className="text-white/60">›</span>
        </Link>
      )}

      {/* 기록하기 — 육아앱식 원탭 생활기록 + 오늘 타임라인 + 상세 입력(체중/직접/스캔) */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/70">{t('recordSection')}</p>
        <Link href={`/schedule?pet=${pet.id}&view=today`} className="text-xs text-white/70 hover:text-white">
          {t('recordMore')} ›
        </Link>
      </div>
      <div className="mt-1.5 space-y-2">
        {/* 원탭 칩(가로 스크롤): 탭하면 지금 시각으로 바로 기록 */}
        <QuickLogBar petId={pet.id} tone="onPrimary" onOpenDetail={setDetailId} />
        {/* 기록 시간순 흐름(무한 스크롤 피드) — 항목을 누르면 상세로 진입 */}
        <RecordFeed petId={pet.id} tone="onPrimary" scroll onSelect={setDetailId} />
        {/* 상세 입력: 체중·직접 입력·영수증 스캔 — 페이지 이동 없이 홈에서 바로 모달로 연다 */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <button type="button" onClick={() => setModal('weight')}
            className="flex items-center justify-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-xs font-medium transition-colors">
            <span aria-hidden>⚖️</span> {t('weight')}
          </button>
          <button type="button" onClick={() => setModal('manual')}
            className="flex items-center justify-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-xs font-medium transition-colors">
            <span aria-hidden>📝</span> {t('recordManual')}
          </button>
          <button type="button" onClick={() => setModal('scan')}
            className="flex items-center justify-center gap-1 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-xs font-medium transition-colors">
            <span aria-hidden>📷</span> {t('scan')}
          </button>
        </div>
      </div>
    </div>

    {detailId && (
      <RecordDetailModal recordId={detailId} onClose={() => setDetailId(null)} />
    )}

    {/* 상세 입력 모달 — 현재 화면 위에 떠서 저장 후 원래 자리로 복귀 (QuickRecordFab 과 동일) */}
    {modal === 'scan' && (
      <RecordsScanModal petId={pet.id} onClose={() => { setModal(null); afterRecord() }} />
    )}
    {/* 직접 기록: 헤더 저장 버튼이 임베드 폼을 구동하는 공용 모달(이중 헤더 제거) */}
    {modal === 'manual' && (
      <RecordFormModal
        petId={pet.id}
        title={t('recordManual')}
        onClose={() => setModal(null)}
        onDone={() => { setModal(null); afterRecord() }}
      />
    )}
    {modal === 'weight' && (
      <div
        className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
        onClick={() => setModal(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto p-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-900">{t('weight')}</p>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label={tc('close')}
              className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <WeightSection petId={pet.id} defaultOpen />
        </div>
      </div>
    )}
    </>
  )
}

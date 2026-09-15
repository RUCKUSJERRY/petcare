'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { calcPetAge, careCategoryIcon, ddayBadge, lifeStageColor, stageLabel, nextAnniversary, daysTogether, togetherMilestone, daysUntil, todayKST } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useTodayLog, useWalkedToday } from '@/hooks/useTodayActivity'
import { QuickLogBar } from '@/app/(dashboard)/pets/_components/QuickLogBar'
import { WalkQuickLog } from './WalkQuickLog'
import { RecordFeed } from '@/app/(dashboard)/pets/_components/RecordFeed'
import { RecordDetailModal } from '@/app/(dashboard)/pets/_components/RecordDetailModal'
import { RecordEntryModals } from '@/app/(dashboard)/pets/_components/RecordEntryModals'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { AchievementShareButton } from '@/components/ui/AchievementShareButton'
import { pickShareableAchievement } from '@/lib/achievement'
import { petMood, petSpeech } from '@/lib/petMood'
import { computeTodayCare } from '@/lib/todayCare'
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
  // 오늘 돌봄 진행(N/4) 표시·산책 액션 문구는 todayCare 네임스페이스를 공유한다
  // (예전 TodayChecklist 와 동일 문구원천 — 걷어낸 뒤에도 습관 신호를 요약카드에 남긴다).
  const tCare = useTranslations('todayCare')
  const qc = useQueryClient()
  const [detailId, setDetailId] = useState<string | null>(null)
  // 상세 입력(체중·직접·스캔)은 페이지 이동 대신 현재 홈 화면 위 모달로 연다 → 저장 후 원래 자리로 복귀.
  // (QuickRecordFab 과 동일 패턴 — 앱 전반의 기록 진입을 일관되게)
  const [modal, setModal] = useState<null | 'weight' | 'manual' | 'scan'>(null)

  // 오늘 돌봄 완료 정도 — 아바타 기분·말풍선에 '지금 이 순간'의 신호를 더하기 위해 조회한다.
  // TodayChecklist·QuickLogBar·캐릭터 카드와 동일한 캐시 키·조회 형태를 공용 훅으로 공유해,
  // 한쪽에서 원탭 기록하면 이 요약 카드의 표정·대사도 즉시 함께 갱신된다(추가 네트워크 없이 캐시 공유).
  const { data: todayLogs = [] } = useTodayLog(selectedPetId)
  const { data: walkedToday = false } = useWalkedToday(selectedPetId)

  if (!selectedPetId) return null

  const pet = pets.find(p => p.id === selectedPetId)
  if (!pet) return null

  const afterRecord = () => {
    qc.invalidateQueries({ queryKey: ['today-timeline', pet.id] })
    qc.invalidateQueries({ queryKey: ['record-feed', pet.id] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    // 이 카드의 표정·말풍선·'오늘 돌봄 완료' 리본은 ['today-log'·'today-walk', pet.id] 에서
    // 파생한다 — 상세 입력 모달(밥·물·배변·체중 등)로 기록해도 즉시 갱신되도록 함께 무효화한다.
    // (다른 기록 경로와 동일 기준. 예전엔 안쪽 RecordForm 의 광범위 무효화에 우연히 의존했다.)
    qc.invalidateQueries({ queryKey: ['today-log', pet.id] })
    qc.invalidateQueries({ queryKey: ['today-walk', pet.id] })
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
  // 오늘 핵심 돌봄(밥·물·배변·산책) 완료 정도 — 방금 챙긴 노력이 표정·대사에 즉시 반영되도록.
  const todayCare = computeTodayCare(todayLogs.map(r => r.category), walkedToday)
  // 연속일 + 오늘 완료도에 따른 아이 '기분' — 아바타 표정·테두리로 정서적 재방문 계기를 준다.
  const mood = petMood(streak, todayCare.doneCount, todayCare.total)
  // 아이가 말을 거는 한 줄 말풍선 — 오늘 돌봄·연속 상태에 맞춰 바뀐다(캐릭터 상호작용).
  const speech = petSpeech(streak, todayCare.doneCount, todayCare.total)
  // 지금 자랑할 만한 성취(이정표 당일·연속 3일+)가 있으면 이미지 카드로 공유할 수 있게 한다.
  const shareable = pickShareableAchievement({ streak, milestone })
  const nextVacc = vaccAlerts
    .filter(v => v.pet_id === pet.id)
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))[0]

  return (
    <>
    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        {/* 아바타 + 기분 반응 — 연속 기록일에 따라 테두리가 밝아지고 아이 표정(이모지)이 바뀐다 */}
        <div className="relative shrink-0" title={mood.label}>
          <PetAvatar photoUrl={pet.photo_url} species={pet.species} name={pet.name}
            className={`w-16 h-16 bg-white/20 ${mood.ring}`} emojiClassName="text-3xl" />
          <span
            aria-label={mood.label}
            role="img"
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-sm leading-none"
          >
            {mood.emoji}
          </span>
        </div>
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
              {/* 성취 나눔 — 이정표 당일·연속 3일+ 일 때 이미지 카드로 공유 */}
              {shareable && (
                <AchievementShareButton
                  icon={shareable.icon}
                  headline={shareable.headline}
                  petName={pet.name}
                  className="bg-white/20 text-white hover:bg-white/30"
                />
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

      {/* 오늘 핵심 돌봄(밥·물·배변·산책) 완주 축하 리본 — 하루를 마친 순간의 즉각 보상.
          위 진행(N/4) 배지가 '몇 개 남았는지'를, 이 리본이 '다 챙김'을 자축해 습관 루프를 닫는다. */}
      {todayCare.total > 0 && todayCare.doneCount >= todayCare.total && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-300/95 text-amber-900 px-3 py-2 shadow-sm">
          <span aria-hidden className="text-base leading-none animate-bounce">🎉</span>
          <p className="text-[13px] font-bold leading-snug">{t('missionComplete', { name: pet.name })}</p>
        </div>
      )}

      {/* 캐릭터 말풍선 — 아이가 말을 거는 한 줄. 오늘 돌봄·연속 상태에 따라 대사가 바뀌어
          숫자·뱃지 위주 신호를 정서적 상호작용으로 확장한다(참여·재방문 유도). */}
      <div className="mt-3 flex items-start gap-2 bg-white/15 rounded-xl px-3 py-2">
        <span aria-hidden className="text-base leading-none shrink-0">{mood.emoji}</span>
        <p className="text-[13px] leading-snug text-white/95">{speech}</p>
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

      {/* 기록하기 — 육아앱식 원탭 생활기록 + 오늘 타임라인 + 상세 입력(체중/직접/스캔).
          오늘 핵심 돌봄 진행(N/4)을 헤더에 함께 노출해, 별도 체크리스트 카드 없이도 '오늘 몇 개
          남았는지'라는 습관 루프 신호를 유지한다(완주 시엔 아래 축하 리본이 대신 알린다). */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-white/70">{t('recordSection')}</p>
          {todayCare.total > 0 && !todayCare.allDone && (
            <span className="text-[11px] font-semibold text-white/85 bg-white/15 rounded-full px-2 py-0.5">
              {tCare('progress', { done: todayCare.doneCount, total: todayCare.total })}
            </span>
          )}
        </div>
        <Link href={`/schedule?pet=${pet.id}&view=today`} className="text-xs text-white/70 hover:text-white">
          {t('recordMore')} ›
        </Link>
      </div>
      <div className="mt-1.5 space-y-2">
        {/* 원탭 칩(가로 스크롤): 탭하면 지금 시각으로 바로 기록 */}
        <QuickLogBar petId={pet.id} tone="onPrimary" onOpenDetail={setDetailId} />
        {/* 산책도 밥·물·배변과 같은 자리에서 — 산책은 records 가 아니라 walks 라 칩에 못 들어가므로
            별도 액션으로 둔다(지금 GPS 시작 / 산책했어요 기록만 선택 시트). */}
        <WalkQuickLog petId={pet.id} walkedToday={walkedToday} tone="onPrimary" />
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

    {/* 상세 입력 모달(체중·직접·스캔) — 현재 화면 위에 떠서 저장 후 원래 자리로 복귀 (공용 컴포넌트) */}
    <RecordEntryModals
      petId={pet.id}
      modal={modal}
      manualTitle={t('recordManual')}
      weightTitle={t('weight')}
      onClose={() => setModal(null)}
      onSaved={() => { setModal(null); afterRecord() }}
    />
    </>
  )
}

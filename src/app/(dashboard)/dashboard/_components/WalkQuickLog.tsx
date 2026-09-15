'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { logManualWalk } from '@/lib/careActions'

/**
 * 오늘 산책 원탭 기록 액션 + 선택 시트('지금 시작 GPS' / '산책했어요 기록만').
 *
 * 산책은 밥·물·배변과 함께 '오늘 핵심 돌봄 4종'이지만 records 가 아니라 walks 로 판정돼
 * QuickLogBar 원탭 칩에 들어가지 않는다. 예전엔 홈의 별도 카드(TodayChecklist)에서만 기록할 수
 * 있었는데, 그 카드를 걷어내고 요약카드(SelectedPetSummary)의 '기록하기' 영역에서 밥·물·배변과
 * 한 곳에서 남기도록 산책 시트·markWalked 로직을 이 공용 컴포넌트로 그대로 옮겼다.
 */
export function WalkQuickLog({
  petId,
  walkedToday,
  tone = 'plain',
}: {
  petId: string
  walkedToday: boolean
  tone?: 'plain' | 'onPrimary'
}) {
  const t = useTranslations('todayCare')
  const supabase = createClient()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(false)
  const onP = tone === 'onPrimary'

  // '산책했어요' — GPS 없이 오늘 산책을 수동 기록한다. (예전 TodayChecklist.markWalked 와 동일 세트)
  const markWalked = async () => {
    if (busy) return
    setBusy(true)
    const { error } = await logManualWalk(supabase, petId)
    setBusy(false)
    setSheet(false)
    if (!error) {
      qc.invalidateQueries({ queryKey: ['today-walk', petId] })
      qc.invalidateQueries({ queryKey: ['weekly-report', petId] })
      // 수동 산책도 산책 목록(mine/shared)에 남으므로 목록 캐시를 무효화한다(['walks',...] 프리픽스).
      qc.invalidateQueries({ queryKey: ['walks'] })
      qc.invalidateQueries({ queryKey: ['walk-goal'] })
      // 회고 거리 합산 반영 (산책 저장 경로와 동일 기준)
      qc.invalidateQueries({ queryKey: ['monthly-recap', petId] })
      // 아이 상세 성장 레벨(PetCharacterCard)은 산책 수도 반영 — 저장·삭제 경로와 동일 기준.
      qc.invalidateQueries({ queryKey: ['pet-care-points', petId] })
    }
  }

  const btnCls = onP
    ? 'w-full flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-xs font-medium transition-colors'
    : 'w-full flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg py-2 text-xs font-medium transition-colors'

  return (
    <>
      {/* 오늘 이미 산책했어도(저녁 산책 등) 다시 열 수 있게 하되, ✓ 로 완료 상태를 알린다. */}
      <button
        type="button"
        onClick={() => setSheet(true)}
        aria-label={walkedToday ? t('walkDone') : t('walkLog')}
        className={btnCls}
      >
        <span aria-hidden>🦮</span>
        {walkedToday ? (
          <span className="flex items-center gap-1">{t('walkDone')} <span aria-hidden>✓</span></span>
        ) : (
          t('walkLog')
        )}
      </button>

      {/* 산책 선택 시트 — 지금 GPS 시작 / 이미 산책했으면 기록만 */}
      {sheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setSheet(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('walkSheetTitle')}
            className="bg-white w-full max-w-lg rounded-t-2xl p-4 pb-6 space-y-3 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-200" />
            <p className="font-bold text-gray-900">{t('walkSheetTitle')}</p>
            <Link
              href="/walks/track?autostart=1"
              onClick={() => setSheet(false)}
              className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 hover:bg-primary-100 transition-colors"
            >
              <span className="text-2xl shrink-0" aria-hidden>🦮</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-primary-700">{t('walkSheetStart')}</div>
                <div className="text-xs text-primary-600/80">{t('walkSheetStartHint')}</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={markWalked}
              disabled={busy}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <span className="text-2xl shrink-0" aria-hidden>✅</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-bold text-gray-900">{t('walkSheetDone')}</div>
                <div className="text-xs text-gray-500">{t('walkSheetDoneHint')}</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

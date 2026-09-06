'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { useTodayLog, useWalkedToday } from '@/hooks/useTodayActivity'
import { logDailyRecord, logManualWalk } from '@/lib/careActions'
import { computeTodayCare, type TodayCareCheckItem } from '@/lib/todayCare'

/**
 * 홈 '오늘의 돌봄 체크' — 매일 챙기는 핵심 4가지(밥·물·배변·산책)를 한 줄 체크리스트로.
 * 하루 습관 루프(재방문·기록 지속)를 명시적 '목표 달성'으로 만들어 리텐션을 유도한다.
 *
 * - 미완료 기록 항목은 탭하면 지금 시각으로 원탭 기록(QuickLogBar 와 동일 입력 경로).
 * - 산책은 walks 로 판정하며, 미완료면 산책 시작 화면으로 딥링크한다.
 * - today-log 캐시 키를 QuickLogBar 와 공유해, 한쪽에서 기록하면 즉시 함께 갱신된다.
 */
export function TodayChecklist() {
  const t = useTranslations('todayCare')
  const supabase = createClient()
  const qc = useQueryClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null
  const [busy, setBusy] = useState<string | null>(null)
  // 산책 타일은 즉시 기록 대신 '지금 시작(GPS)' vs '산책했어요(기록만)' 선택 시트를 연다 —
  // 다른 타일처럼 눌렀는데 실수로 GPS 추적 화면으로 튕겨 들어가던 문제를 없앤다.
  const [walkSheet, setWalkSheet] = useState(false)

  // QuickLogBar·홈 요약카드·캐릭터 카드와 ['today-log']·['today-walk'] 캐시를 공유한다(공용 훅).
  // 한쪽에서 원탭 기록하면(같은 키 무효화) 이 체크리스트도 즉시 함께 갱신된다.
  const { data: todayLogs = [] } = useTodayLog(selectedPetId)
  const todayCategories = todayLogs.map(r => r.category)

  const { data: walkedToday = false } = useWalkedToday(selectedPetId)

  if (!pet || !selectedPetId) return null

  const status = computeTodayCare(todayCategories, walkedToday)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['today-log', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['record-feed', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    qc.invalidateQueries({ queryKey: ['weekly-report', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['life-pattern', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    // 지난달 회고 카드도 기록을 집계한다. QuickLogBar·RecordForm 등 동일 기록 쓰기 경로는 이미
    // 무효화하는데 이 홈 체크리스트만 누락돼, 여기서 체크하면 회고가 최대 60초간 stale 했다.
    qc.invalidateQueries({ queryKey: ['monthly-recap', selectedPetId] })
  }

  const check = async (item: TodayCareCheckItem) => {
    if (!item.category || item.done || busy) return
    setBusy(item.key)
    const { error } = await logDailyRecord(supabase, selectedPetId, item.category)
    setBusy(null)
    if (!error) invalidate()
  }

  // '산책했어요' — GPS 없이 오늘 산책을 수동 기록하고 체크를 채운다.
  const markWalked = async () => {
    if (busy) return
    setBusy('walk')
    const { error } = await logManualWalk(supabase, selectedPetId)
    setBusy(null)
    setWalkSheet(false)
    if (!error) {
      qc.invalidateQueries({ queryKey: ['today-walk', selectedPetId] })
      qc.invalidateQueries({ queryKey: ['weekly-report', selectedPetId] })
      // 수동 산책도 산책 목록(mine/shared)에 남으므로 목록 캐시를 무효화한다.
      // (예전엔 어디서도 쓰지 않는 ['walk-stats'] 팬텀 키를 무효화해 목록이 최대 60초간
      //  새 수동 산책을 반영하지 못했다 — 실제 목록 키는 ['walks',...] 프리픽스다.)
      qc.invalidateQueries({ queryKey: ['walks'] })
      qc.invalidateQueries({ queryKey: ['walk-goal'] })
      // 회고 거리 합산 반영 (산책 저장 경로와 동일 기준)
      qc.invalidateQueries({ queryKey: ['monthly-recap', selectedPetId] })
      // 아이 상세 성장 레벨(PetCharacterCard)은 산책 수도 반영 — 저장·삭제 경로와 동일 기준.
      qc.invalidateQueries({ queryKey: ['pet-care-points', selectedPetId] })
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden>✅</span>
          <span className="font-bold text-gray-900 text-sm">{t('title')}</span>
        </div>
        <span className={`text-xs font-bold ${status.allDone ? 'text-primary-600' : 'text-gray-400'}`}>
          {status.allDone ? t('allDone') : t('progress', { done: status.doneCount, total: status.total })}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {status.items.map(item => {
          const label = (
            <>
              <span className={`text-2xl leading-none ${item.done ? '' : 'grayscale opacity-40'}`} aria-hidden>
                {item.icon}
              </span>
              <span className={`text-xs font-semibold mt-1 ${item.done ? 'text-gray-900' : 'text-gray-400'}`}>
                {item.label}
              </span>
              <span className={`text-[11px] font-bold mt-0.5 ${item.done ? 'text-primary-600' : 'text-gray-300'}`}>
                {item.done ? '✓' : t('addShort')}
              </span>
            </>
          )
          const cls = `flex flex-col items-center rounded-xl border py-2.5 transition-colors ${
            item.done ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200 hover:border-primary-300'
          }`
          // 산책 미완료 → 선택 시트(지금 시작 GPS / 산책했어요 기록만). 그 외 미완료 → 원탭 기록.
          if (item.key === 'walk' && !item.done) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setWalkSheet(true)}
                disabled={busy === 'walk'}
                aria-label={t('addAria', { label: item.label })}
                className={`${cls} disabled:opacity-100`}
              >
                {label}
              </button>
            )
          }
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => check(item)}
              disabled={item.done || busy === item.key}
              aria-label={item.done ? undefined : t('addAria', { label: item.label })}
              className={`${cls} disabled:opacity-100`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 오늘 돌봄 전부 완료 시 축하 반응 — 하루 습관 루프를 '목표 달성'의 정서적 보상으로 닫아
          매일 완료하고 싶게 만든다(캐릭터 반응과 톤을 맞춤). */}
      {status.allDone && (
        <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-200 px-3 py-2">
          <span aria-hidden className="text-lg leading-none shrink-0">🥰</span>
          <p className="text-xs font-semibold text-primary-700 leading-snug">{t('celebrate')}</p>
        </div>
      )}

      {/* 산책 선택 시트 — 지금 GPS 시작 / 이미 산책했으면 기록만 */}
      {walkSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setWalkSheet(false)}
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
              onClick={() => setWalkSheet(false)}
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
              disabled={busy === 'walk'}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <span className="text-2xl shrink-0" aria-hidden>✅</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-bold text-gray-900">{t('walkSheetDone')}</div>
                <div className="text-xs text-gray-400">{t('walkSheetDoneHint')}</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

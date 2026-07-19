'use client'

import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { careCategoryIcon, ddayBadge, ddayToneClass, todayKST } from '@/lib/utils'
import { completeCareToday } from '@/lib/careActions'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import type { CareAlert, Pet } from '@/types'

/**
 * 30일 이내/지난 건강 관리 일정 알림 (접종·심장사상충·구충 등).
 * 선택된 아이의 알림은 상단 요약 카드에 이미 표시되므로 여기서는 제외(중복 방지).
 * 각 항목은 "완료"로 바로 처리(오늘 시행 기록 추가 + 반복이면 다음 일정으로 갱신).
 */
export function VaccAlerts({ pets, alerts }: { pets: Pet[]; alerts: CareAlert[] }) {
  const { selectedPetId } = useSelectedPet()
  const t = useTranslations('vaccAlerts')
  const tc = useTranslations('common')
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  // 완료 처리 중 시행일을 고르는 항목·선택 날짜. 반복(매월 N일·매년)의 기준일이 이 날짜에서
  // 파생되므로, 늦게 눌러도 실제 시행일로 남겨 "매월 1일" 같은 규칙이 처리한 날로 밀리지 않게 한다.
  const [editId, setEditId] = useState<string | null>(null)
  const [doneOn, setDoneOn] = useState('')

  const shown = selectedPetId
    ? alerts.filter(a => a.pet_id !== selectedPetId)
    : alerts

  if (shown.length === 0) return null

  // D-day 배지는 KST '오늘' 기준으로 계산한다. (서버 대시보드가 KST로 산출한 알림 목록과
  // 배지 표기가 자정 부근에 어긋나지 않도록 클라이언트도 동일 기준을 쓴다.)
  const today = todayKST()

  const startComplete = (v: CareAlert) => {
    if (!v.record_id) return
    setEditId(v.record_id)
    setDoneOn(today) // 기본값은 오늘 — 대개 오늘 처리하므로 그대로 '기록'만 누르면 된다
  }

  const complete = async (v: CareAlert) => {
    if (!v.record_id) return
    setBusyId(v.record_id)
    const { error } = await completeCareToday(supabase, v, doneOn || today)
    setBusyId(null)
    if (!error) { setEditId(null); router.refresh() }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden>🗓️</span>
        <span className="font-semibold text-amber-800 text-sm">
          {selectedPetId ? t('otherTitle') : t('allTitle')}
        </span>
      </div>
      {shown.slice(0, 4).map(v => {
        const pet = pets.find(p => p.id === v.pet_id)
        const badge = ddayBadge(v.next_due_on, today)
        const editing = !!v.record_id && editId === v.record_id
        return (
          <div key={v.record_id ?? `${v.pet_id}|${v.category}|${v.title}`} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span aria-hidden>{careCategoryIcon(v.category)}</span>
              <span className="text-gray-700 truncate flex-1">
                {pet?.name} · {v.title}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${ddayToneClass(badge.tone)}`}>
                {badge.text}
              </span>
              {v.record_id && !editing && (
                <button
                  onClick={() => startComplete(v)}
                  disabled={busyId === v.record_id}
                  className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full bg-white text-amber-700 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                >
                  {`✓ ${t('complete')}`}
                </button>
              )}
            </div>
            {/* 완료 시행일 선택 — 늦게 눌러도 실제 시행한 날로 남겨 반복 규칙 기준일이 밀리지 않게 한다 */}
            {editing && (
              <div className="flex items-center gap-1.5 pl-6">
                <label className="text-xs text-amber-700 shrink-0">{t('doneDateLabel')}</label>
                <input
                  type="date"
                  value={doneOn}
                  max={today}
                  onChange={e => setDoneOn(e.target.value)}
                  className="text-xs rounded-lg border border-amber-300 bg-white px-2 py-1 min-w-0 flex-1"
                />
                <button
                  onClick={() => complete(v)}
                  disabled={busyId === v.record_id}
                  className="text-xs font-semibold shrink-0 px-2 py-1 rounded-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {busyId === v.record_id ? t('completing') : t('doneRecord')}
                </button>
                <button
                  onClick={() => setEditId(null)}
                  disabled={busyId === v.record_id}
                  className="text-xs font-medium shrink-0 px-1.5 py-1 text-amber-700 disabled:opacity-50"
                >
                  {tc('cancel')}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {shown.length > 4 && (
        <p className="text-xs text-amber-600 pt-0.5">{t('moreCount', { count: shown.length - 4 })}</p>
      )}
      <Link href="/schedule" className="block text-xs text-amber-700 font-semibold pt-1">
        {t('viewAll')}
      </Link>
    </div>
  )
}

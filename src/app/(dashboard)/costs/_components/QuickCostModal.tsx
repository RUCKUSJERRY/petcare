'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMyPets } from '@/hooks/useMyPets'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { RECORD_CATEGORIES, defaultRecordTitle } from '@/lib/records'
import { careCategoryIcon, todayKST } from '@/lib/utils'
import type { RecordCategory } from '@/types'

/**
 * 비용 빠른 입력 — 지출 1건을 '금액 + 항목 + 날짜'만으로 바로 남긴다.
 * 전체 기록 폼(카테고리→제목→날짜→장소→…→비용)을 거치던 마찰을 줄이기 위한 경량 입력.
 * 장소·메모·사진·반복이 필요하면 '자세히 입력'으로 전체 폼으로 전환한다.
 */
export function QuickCostModal({
  petId, onClose, onDone, onDetail,
}: {
  petId: string | null
  onClose: () => void
  onDone: () => void
  /** 장소·메모·사진 등 상세가 필요할 때 전체 기록 폼으로 전환. 이미 입력한 금액·항목·날짜를 넘겨
   *  전체 폼에서 다시 입력하지 않게 한다. */
  onDetail: (draft: { amount: string; category: RecordCategory; date: string }) => void
}) {
  const t = useTranslations('costs')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: pets = [] } = useMyPets()

  const [selPet, setSelPet] = useState<string | null>(petId ?? (pets.length === 1 ? pets[0].id : null))
  const [amount, setAmount] = useState('')
  // 직전에 쓴 항목을 기본값으로 — 매번 같은 지출(예: 사료)을 넣는데 항목을 다시 고르는 마찰을 줄인다.
  // 저장된 값이 유효한 카테고리일 때만 사용하고, 없으면 '진료'로 폴백한다.
  const [category, setCategory] = useState<RecordCategory>(() => {
    if (typeof window === 'undefined') return '진료'
    const last = window.localStorage.getItem('petcare_last_cost_category')
    return last && (RECORD_CATEGORIES as readonly string[]).includes(last) ? (last as RecordCategory) : '진료'
  })
  const [date, setDate] = useState(todayKST())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => { amountRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [saving, onClose])

  const targetPet = petId ?? selPet

  const save = async () => {
    const won = parseInt(amount, 10)
    if (!won || won <= 0) { setError(t('quickCostAmountRequired')); return }
    if (!targetPet) { setError(t('quickCostPetRequired')); return }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('records').insert({
      pet_id: targetPet,
      category,
      title: defaultRecordTitle(category),
      event_on: date,
      cost: won,
    })
    setSaving(false)
    if (insErr) { setError(t('quickCostSaveFailed')); return }
    // 다음 빠른 입력의 기본 항목으로 재사용 (반복 지출 입력 마찰 완화)
    try { window.localStorage.setItem('petcare_last_cost_category', category) } catch { /* 저장 실패는 무시 */ }
    // 비용도 결국 records 한 건이라, 다른 기록 경로(QuickLogBar·RecordForm)와 동일한 캐시들을
    // 함께 무효화해야 홈 '오늘 타임라인'·오늘 피드(선택 아이 + '전체'=null 스코프)와 주간·월간
    // 집계가 새 지출을 즉시 반영한다. 예전엔 cost-records·record-feed 만 무효화해, 오늘 남긴
    // 지출이 홈 타임라인·'전체 보기'에서 최대 60초간 안 보였다.
    qc.invalidateQueries({ queryKey: ['cost-records'] })
    qc.invalidateQueries({ queryKey: ['today-timeline', targetPet] })
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', targetPet] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    qc.invalidateQueries({ queryKey: ['records', targetPet] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    // 빠른 비용 입력은 항목으로 생활기록 카테고리(식사·물·배변·투약 등)도 고를 수 있다 —
    // 오늘 날짜로 그런 지출을 남기면 records 한 건이 '오늘의 돌봄'(today-log)·생활 패턴(life-pattern)
    // 집계에도 포함되므로, 전체 기록 폼(RecordForm)과 동일하게 이 두 캐시도 함께 무효화한다.
    // (예전엔 누락돼, 오늘 '식사' 지출을 남겨도 홈 '오늘 돌봄' 카운트·생활 패턴이 최대 60초간 옛값이었다.)
    qc.invalidateQueries({ queryKey: ['today-log', targetPet] })
    qc.invalidateQueries({ queryKey: ['life-pattern', targetPet] })
    // 주간 리포트·월간 회고는 지출 합계를 집계원으로 쓴다(키 접두 매칭으로 시작일 포함 무효화).
    qc.invalidateQueries({ queryKey: ['weekly-report', targetPet] })
    qc.invalidateQueries({ queryKey: ['monthly-recap', targetPet] })
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => { if (!saving) onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('quickCostTitle')}
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-4 space-y-3.5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-gray-900">{t('quickCostTitle')}</p>
          <button onClick={() => { if (!saving) onClose() }} aria-label={tc('close')} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>

        {/* 대상 아이 — 아이가 고정되지 않았고 2마리 이상일 때만 */}
        {!petId && pets.length > 1 && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('quickCostPet')}</label>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              {pets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelPet(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 border transition-colors ${
                    targetPet === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  <PetAvatar photoUrl={p.photo_url} species={p.species} className="w-4 h-4" emojiClassName="text-sm leading-none" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 금액 (핵심) */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('quickCostAmount')}</label>
          <div className="relative">
            <input
              ref={amountRef}
              className="input pr-8 text-lg font-semibold"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{t('quickCostWon')}</span>
          </div>
        </div>

        {/* 항목 + 날짜 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('quickCostCategory')}</label>
            <select
              className="input"
              value={category}
              onChange={e => setCategory(e.target.value as RecordCategory)}
            >
              {RECORD_CATEGORIES.map(c => (
                <option key={c} value={c}>{careCategoryIcon(c)} {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">{t('quickCostDate')}</label>
            <input className="input" type="date" value={date} max={todayKST()} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-60">
          {saving ? tc('saving') : tc('save')}
        </button>

        <button onClick={() => onDetail({ amount, category, date })} className="w-full text-center text-xs text-gray-500 hover:text-primary-600">
          {t('quickCostDetail')}
        </button>
      </div>
    </div>
  )
}

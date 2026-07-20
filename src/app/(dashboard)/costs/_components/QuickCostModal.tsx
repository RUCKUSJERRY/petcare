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
  /** 장소·메모·사진 등 상세가 필요할 때 전체 기록 폼으로 전환 */
  onDetail: () => void
}) {
  const t = useTranslations('costs')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: pets = [] } = useMyPets()

  const [selPet, setSelPet] = useState<string | null>(petId ?? (pets.length === 1 ? pets[0].id : null))
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<RecordCategory>('진료')
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
    qc.invalidateQueries({ queryKey: ['cost-records'] })
    qc.invalidateQueries({ queryKey: ['record-feed', targetPet] })
    qc.invalidateQueries({ queryKey: ['records', targetPet] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
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
          <button onClick={onClose} aria-label={tc('close')} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500">✕</button>
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

        <button onClick={onDetail} className="w-full text-center text-xs text-gray-500 hover:text-primary-600">
          {t('quickCostDetail')}
        </button>
      </div>
    </div>
  )
}

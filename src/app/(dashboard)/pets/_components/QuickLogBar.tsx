'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, todayKST } from '@/lib/utils'
import { CATEGORY_GROUPS, CATEGORY_CONFIG } from '@/lib/records'
import type { RecordCategory } from '@/types'

type TodayLog = { id: string; category: string; event_at: string | null }

const hhmm = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 육아앱(베이비타임)식 "오늘의 기록" 원탭 바.
 * 칩을 누르면 지금 시각으로 생활기록(식사·배변·투약 등)이 바로 저장되고,
 * 되돌리기 토스트가 잠깐 뜬다. 아이별 오늘 누적 횟수도 칩에 표시한다.
 * 홈(선택 아이 요약 카드)과 일정 '오늘' 탭에서 재사용한다.
 */
export function QuickLogBar({
  petId,
  tone = 'plain',
  onLogged,
  onOpenDetail,
}: {
  petId: string | null
  tone?: 'plain' | 'onPrimary'
  onLogged?: () => void
  /** 방금 기록한 항목(또는 토스트)을 누르면 상세로 진입 */
  onOpenDetail?: (id: string) => void
}) {
  const t = useTranslations('quickLog')
  const supabase = createClient()
  const qc = useQueryClient()
  const [toast, setToast] = useState<{ id: string; label: string; time: string } | null>(null)
  const [notice, setNotice] = useState(false)
  const [undoErr, setUndoErr] = useState(false)
  const [busy, setBusy] = useState<RecordCategory | null>(null)
  // 배변처럼 세부 종류를 골라야 하는 카테고리를 탭하면, 즉시 저장 대신 보기를 펼친다.
  const [subFor, setSubFor] = useState<RecordCategory | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['today-log', petId],
    enabled: !!petId,
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('id, category, event_at')
        .eq('pet_id', petId!)
        .eq('event_on', todayKST())
        .order('event_at', { ascending: false })
      return (data ?? []) as TodayLog[]
    },
  })

  // 카테고리별 오늘 횟수 + 마지막 시각
  const stat = new Map<string, { count: number; last: string | null }>()
  for (const r of todayLogs) {
    const s = stat.get(r.category)
    if (s) s.count += 1
    else stat.set(r.category, { count: 1, last: r.event_at })
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['today-log', petId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', petId] })
    qc.invalidateQueries({ queryKey: ['record-feed', petId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    if (petId) qc.invalidateQueries({ queryKey: ['records', petId] })
  }

  const showToast = (id: string, label: string, time: string) => {
    setToast({ id, label, time })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 4000)
  }

  const log = async (cat: RecordCategory, title?: string) => {
    if (!petId) { setNotice(true); return }
    setNotice(false)
    setSubFor(null)
    setBusy(cat)
    const now = new Date()
    const label = title ?? cat
    const { data, error } = await supabase
      .from('records')
      .insert({ pet_id: petId, category: cat, title: label, event_on: todayKST(), event_at: now.toISOString() })
      .select('id')
      .single()
    setBusy(null)
    if (error || !data) return
    setUndoErr(false)
    showToast(data.id as string, label, hhmm(now.toISOString()))
    invalidate()
    onLogged?.()
  }

  // 탭 처리: 세부 보기(배변)가 있으면 펼치고, 없으면 지금 시각으로 즉시 기록한다.
  const handleTap = (cat: RecordCategory) => {
    if (!petId) { setNotice(true); return }
    if (CATEGORY_CONFIG[cat].titleOptions) {
      setSubFor(prev => (prev === cat ? null : cat))
      return
    }
    log(cat)
  }

  const undo = async () => {
    if (!toast) return
    const snapshot = toast
    setToast(null)
    setUndoErr(false)
    if (timer.current) clearTimeout(timer.current)
    const { error } = await supabase.from('records').delete().eq('id', snapshot.id)
    if (error) {
      // 삭제 실패 시 토스트를 되살려 사용자가 다시 시도할 수 있게 한다(조용한 실패 방지)
      setUndoErr(true)
      showToast(snapshot.id, snapshot.label, snapshot.time)
      return
    }
    invalidate()
  }

  const onP = tone === 'onPrimary'
  const chipBase = onP
    ? 'bg-white/15 hover:bg-white/25 text-white'
    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
  const badgeCls = onP ? 'bg-white/30 text-white' : 'bg-primary-100 text-primary-600'
  // 가로 스크롤 끝을 알리는 페이드(스와이프 가능 암시) — 톤별 배경색에 맞춤
  const fadeFrom = onP ? 'from-primary-600' : 'from-white'

  return (
    <div>
      {/* 원탭 칩 — 생활관리 / 건강관리 그룹별로, 일반 기록 폼과 같은 작은 가로 칩 스타일.
          좌우로 밀어 더 많은 항목 선택(오른쪽 페이드로 암시). */}
      <div className="space-y-1.5">
        {CATEGORY_GROUPS.map(g => (
          <div key={g.key}>
            <p className={`text-[11px] font-semibold mb-1 ${onP ? 'text-white/70' : 'text-gray-400'}`}>{g.label}</p>
            <div className="relative">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 snap-x">
                {g.categories.map(cat => {
                  const s = stat.get(cat)
                  const active = subFor === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleTap(cat)}
                      disabled={busy === cat}
                      className={`relative shrink-0 snap-start whitespace-nowrap flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                        active ? (onP ? 'bg-white text-primary-600' : 'bg-primary-500 text-white border border-primary-500') : chipBase
                      }`}
                    >
                      <span aria-hidden>{careCategoryIcon(cat)}</span>
                      <span>{cat}</span>
                      {s && s.count > 0 && (
                        <span className={`ml-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[10px] font-bold leading-[15px] ${badgeCls}`}>
                          {s.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* 오른쪽에 더 있다는 페이드 힌트 */}
              <div className={`pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l ${fadeFrom} to-transparent`} />
            </div>
          </div>
        ))}
      </div>

      {/* 배변 등 세부 종류 선택 — 탭하면 소변/대변/둘다 중 골라 저장 */}
      {subFor && CATEGORY_CONFIG[subFor].titleOptions && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 ${onP ? 'bg-white/15' : 'bg-gray-50 border border-gray-100'}`}>
          <span className={`text-xs font-medium shrink-0 ${onP ? 'text-white/90' : 'text-gray-500'}`} aria-hidden>
            {careCategoryIcon(subFor)} {subFor}
          </span>
          {CATEGORY_CONFIG[subFor].titleOptions!.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => log(subFor, opt)}
              disabled={busy === subFor}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${onP ? 'bg-white text-primary-600' : 'bg-primary-500 text-white'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p className={`mt-1.5 text-xs ${onP ? 'text-white/90' : 'text-amber-600'}`}>{t('needPet')}</p>
      )}

      {toast && (
        <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${onP ? 'bg-white/20 text-white' : 'bg-gray-900 text-white'}`}>
          <button
            type="button"
            onClick={() => onOpenDetail?.(toast.id)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <span aria-hidden>{careCategoryIcon(toast.label)}</span>
            <span className="flex-1 truncate">{t('logged', { label: toast.label })} · {toast.time}</span>
            {onOpenDetail && <span aria-hidden className="opacity-60 shrink-0">›</span>}
          </button>
          <button onClick={undo} className="text-xs font-semibold underline shrink-0">{t('undo')}</button>
        </div>
      )}

      {undoErr && (
        <p className={`mt-1.5 text-xs ${onP ? 'text-white/90' : 'text-amber-600'}`}>{t('undoFailed')}</p>
      )}
    </div>
  )
}

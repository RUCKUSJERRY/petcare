'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, todayKST } from '@/lib/utils'
import { DAILY_LOG_CATEGORIES } from '@/lib/records'
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
  const [busy, setBusy] = useState<RecordCategory | null>(null)
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
        .in('category', DAILY_LOG_CATEGORIES)
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

  const log = async (cat: RecordCategory) => {
    if (!petId) { setNotice(true); return }
    setNotice(false)
    setBusy(cat)
    const now = new Date()
    const { data, error } = await supabase
      .from('records')
      .insert({ pet_id: petId, category: cat, title: cat, event_on: todayKST(), event_at: now.toISOString() })
      .select('id')
      .single()
    setBusy(null)
    if (error || !data) return
    showToast(data.id as string, cat, hhmm(now.toISOString()))
    invalidate()
    onLogged?.()
  }

  const undo = async () => {
    if (!toast) return
    const id = toast.id
    setToast(null)
    if (timer.current) clearTimeout(timer.current)
    await supabase.from('records').delete().eq('id', id)
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
      {/* 원탭 칩 — 가로 스크롤(커뮤니티 필터식). 좌우로 밀어 더 많은 항목 선택 */}
      <div className="relative">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 snap-x">
          {DAILY_LOG_CATEGORIES.map(cat => {
            const s = stat.get(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => log(cat)}
                disabled={busy === cat}
                className={`relative w-[58px] shrink-0 snap-start flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 transition-colors disabled:opacity-60 ${chipBase}`}
              >
                {s && s.count > 0 && (
                  <span className={`absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[10px] font-bold leading-[15px] ${badgeCls}`}>
                    {s.count}
                  </span>
                )}
                <span className="text-lg leading-none" aria-hidden>{careCategoryIcon(cat)}</span>
                <span className="text-[11px] font-medium">{cat}</span>
              </button>
            )
          })}
        </div>
        {/* 오른쪽에 더 있다는 페이드 힌트 */}
        <div className={`pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l ${fadeFrom} to-transparent`} />
      </div>

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
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon } from '@/lib/utils'
import { CATEGORY_GROUPS, CATEGORY_CONFIG } from '@/lib/records'
import { logDailyRecord } from '@/lib/careActions'
import { useTodayLog } from '@/hooks/useTodayActivity'
import type { RecordCategory } from '@/types'

const hhmm = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  // 되돌리기 토스트를 '스택'으로 둔다. 이 바의 목적은 밥→물→배변처럼 빠르게 연속 원탭하는 것인데,
  // 토스트가 1개뿐이면 두 번째 기록이 첫 토스트를 덮어써 먼저 기록한 건을 더 이상 되돌릴 수 없었다.
  // 최근 N건을 각각 되돌릴 수 있게 유지한다(각 토스트는 자기 타이머로 4초 뒤 사라진다).
  const [toasts, setToasts] = useState<{ id: string; label: string; time: string; cat: RecordCategory }[]>([])
  const [notice, setNotice] = useState(false)
  const [undoErr, setUndoErr] = useState(false)
  // 원탭 저장 실패 시 조용히 넘기면 사용자는 탭이 안 먹은 줄 알고 다시 눌러 중복 기록되거나
  // 앱이 멈춘 것으로 오해한다. 예전엔 작은 정적 텍스트가 다음 성공까지 잔류해 놓치기 쉬웠다 —
  // 어떤 항목이 실패했는지 담아, 성공 토스트처럼 잠깐 떴다 사라지되 '다시 시도'를 제공한다.
  const [saveErr, setSaveErr] = useState<{ cat: RecordCategory; title: string } | null>(null)
  // 저장 실패 안내 자동 소멸 타이머(성공 토스트와 동일한 일시성). 언마운트/재실패 시 정리한다.
  const saveErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busy, setBusy] = useState<RecordCategory | null>(null)
  // 배변처럼 세부 종류를 골라야 하는 카테고리를 탭하면, 즉시 저장 대신 보기를 펼친다.
  const [subFor, setSubFor] = useState<RecordCategory | null>(null)
  // 토스트별 자동 소멸 타이머(id → timeout). 언마운트 시 일괄 정리한다.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach(clearTimeout); map.clear()
      if (saveErrTimer.current) clearTimeout(saveErrTimer.current)
    }
  }, [])

  // 오늘 생활기록 — 홈 요약카드·오늘 돌봄 체크·캐릭터 카드와 ['today-log', petId] 캐시를 공유한다.
  const { data: todayLogs = [] } = useTodayLog(petId)

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
    // '전체 아이'(null 스코프) 타임라인·피드도 함께 갱신 — 일정 '오늘' 탭과 홈(선택 없음)에서
    // TodayTimeline/RecordFeed 가 petId=null 로 쓰이는데, 특정 아이로 원탭 기록하면 이 캐시가
    // 남아 최대 60초간 새 기록이 안 보였다(다른 기록 경로와 동일하게 null 키까지 무효화).
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    if (petId) {
      // 홈 생활 패턴 카드(최근 14일 추이·공백)도 새 기록 즉시 반영되도록 갱신
      qc.invalidateQueries({ queryKey: ['life-pattern', petId] })
      // 홈 주간 리포트(7일 활동·성장 레벨)·월간 회고도 이 기록을 집계원으로 쓴다 — 함께 무효화해야
      // 원탭 기록 직후 옛값(레벨·활동 합계)이 staleTime 만큼 남지 않는다. (키 접두 매칭으로
      // ['monthly-recap', petId, 시작일] 도 함께 무효화됨.)
      qc.invalidateQueries({ queryKey: ['weekly-report', petId] })
      qc.invalidateQueries({ queryKey: ['monthly-recap', petId] })
    }
  }

  // 최근 되돌리기 토스트를 몇 개까지 쌓아둘지 — 연속 원탭을 각각 되돌릴 수 있게 하되,
  // 화면을 덮지 않도록 상한을 둔다. 상한을 넘으면 가장 오래된 것부터 흘려보낸다.
  const MAX_TOASTS = 4

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id))
    const tm = timers.current.get(id)
    if (tm) { clearTimeout(tm); timers.current.delete(id) }
  }

  const showToast = (id: string, label: string, time: string, cat: RecordCategory) => {
    setToasts(prev => {
      const next = [...prev, { id, label, time, cat }]
      if (next.length > MAX_TOASTS) {
        // 상한 초과분(가장 오래된 것)은 타이머까지 정리하고 버린다.
        for (const d of next.slice(0, next.length - MAX_TOASTS)) {
          const tm = timers.current.get(d.id)
          if (tm) { clearTimeout(tm); timers.current.delete(d.id) }
        }
        return next.slice(next.length - MAX_TOASTS)
      }
      return next
    })
    const tm = setTimeout(() => removeToast(id), 4000)
    timers.current.set(id, tm)
  }

  const clearSaveErr = () => {
    if (saveErrTimer.current) { clearTimeout(saveErrTimer.current); saveErrTimer.current = null }
    setSaveErr(null)
  }

  const log = async (cat: RecordCategory, title?: string) => {
    if (!petId) { setNotice(true); return }
    setNotice(false)
    clearSaveErr()
    setSubFor(null)
    setBusy(cat)
    const label = title ?? cat
    const { id, at, error } = await logDailyRecord(supabase, petId, cat, label)
    setBusy(null)
    if (error || !id) {
      // 성공 토스트와 동일한 일시성: 잠깐 떴다 자동으로 사라진다(잔류 방지). 재시도 액션 제공.
      setSaveErr({ cat, title: label })
      saveErrTimer.current = setTimeout(() => setSaveErr(null), 6000)
      return
    }
    setUndoErr(false)
    showToast(id, label, hhmm(at.toISOString()), cat)
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

  const undo = async (snapshot: { id: string; label: string; time: string; cat: RecordCategory }) => {
    setUndoErr(false)
    removeToast(snapshot.id)
    const { error } = await supabase.from('records').delete().eq('id', snapshot.id)
    if (error) {
      // 삭제 실패 시 토스트를 되살려 사용자가 다시 시도할 수 있게 한다(조용한 실패 방지)
      setUndoErr(true)
      showToast(snapshot.id, snapshot.label, snapshot.time, snapshot.cat)
      return
    }
    invalidate()
    // 되돌리기도 기록 건수를 바꾸므로 저장과 대칭으로 onLogged 를 호출한다. 아이 상세 화면에선
    // 이 콜백이 캐릭터·성장 카드(연속·레벨·기분: ['pet-streak']·['pet-care-points'])까지 갱신하는데,
    // 예전엔 undo 가 이를 부르지 않아 방금 되돌린 기록이 사라진 뒤에도 그 카드들이 최대 60초간
    // 옛 연속·레벨을 보여줬다. (invalidate() 는 공용 캐시만 무효화하고 이 카드 전용 키는 다루지 않는다.)
    onLogged?.()
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
                      className={`relative shrink-0 snap-start whitespace-nowrap flex items-center justify-center gap-1 rounded-full px-3 py-2 min-h-10 text-xs font-medium transition-colors disabled:opacity-60 ${
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
              className={`px-3 py-2 min-h-10 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${onP ? 'bg-white text-primary-600' : 'bg-primary-500 text-white'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p className={`mt-1.5 text-xs ${onP ? 'text-white/90' : 'text-amber-600'}`}>{t('needPet')}</p>
      )}

      {/* 저장 실패 토스트 — 성공 토스트와 같은 자리·모양으로 잠깐 떴다 사라지되, '다시 시도'로
          방금 실패한 항목을 바로 재저장할 수 있게 한다(잔류·조용한 실패 방지). */}
      {saveErr && (
        <div
          role="alert"
          className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${onP ? 'bg-white/20 text-white' : 'bg-amber-600 text-white'}`}
        >
          <span aria-hidden>⚠️</span>
          <span className="flex-1 truncate">{t('saveFailedShort', { label: saveErr.title })}</span>
          <button
            type="button"
            onClick={() => { const s = saveErr; clearSaveErr(); log(s.cat, s.title) }}
            className="shrink-0 font-bold text-white underline underline-offset-2"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* 최근 원탭 기록 토스트(각각 되돌리기 가능) — 최신이 아래로 쌓인다 */}
      {toasts.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {toasts.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${onP ? 'bg-white/20 text-white' : 'bg-gray-900 text-white'}`}
            >
              <button
                type="button"
                onClick={() => onOpenDetail?.(item.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span aria-hidden>{careCategoryIcon(item.cat)}</span>
                <span className="flex-1 truncate">{t('logged', { label: item.label })} · {item.time}</span>
                {onOpenDetail && <span aria-hidden className="opacity-60 shrink-0">›</span>}
              </button>
              <button onClick={() => undo(item)} className="text-xs font-semibold underline shrink-0">{t('undo')}</button>
            </div>
          ))}
        </div>
      )}

      {undoErr && (
        <p className={`mt-1.5 text-xs ${onP ? 'text-white/90' : 'text-amber-600'}`}>{t('undoFailed')}</p>
      )}
    </div>
  )
}

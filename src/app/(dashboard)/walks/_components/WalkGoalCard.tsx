'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatDistance } from '@/lib/utils'
import { summarizeWalks, weeklyGoalProgress, type WalkGoal, type WalkLike } from '@/lib/walkStats'

const STORAGE_KEY = 'petcare:walk-weekly-goal'
const EMPTY: WalkGoal = { distanceKm: 0, count: 0 }

function loadGoal(): WalkGoal {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const g = JSON.parse(raw)
    return { distanceKm: Math.max(0, Number(g.distanceKm) || 0), count: Math.max(0, Number(g.count) || 0) }
  } catch {
    return EMPTY
  }
}

function saveGoal(g: WalkGoal) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(g))
  } catch {
    /* 저장 실패는 무시 (시크릿 모드 등) */
  }
}

/** 이번 주 산책 목표(거리/횟수) 설정 + 달성률 카드. 목표는 기기(localStorage)에 저장한다. */
export function WalkGoalCard({ walks }: { walks: WalkLike[] }) {
  const t = useTranslations('walks')
  // SSR/CSR 첫 렌더 일치(하이드레이션)를 위해 마운트 후 localStorage를 읽는다.
  const [goal, setGoal] = useState<WalkGoal>(EMPTY)
  const [mounted, setMounted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ distanceKm: '', count: '' })

  useEffect(() => {
    setGoal(loadGoal())
    setMounted(true)
  }, [])

  if (!mounted) return null

  const thisWeek = summarizeWalks(walks).thisWeek
  const p = weeklyGoalProgress(thisWeek, goal)

  const openEditor = () => {
    setDraft({
      distanceKm: goal.distanceKm ? String(goal.distanceKm) : '',
      count: goal.count ? String(goal.count) : '',
    })
    setEditing(true)
  }

  const commit = () => {
    const next: WalkGoal = {
      distanceKm: Math.max(0, Number(draft.distanceKm) || 0),
      count: Math.max(0, Math.round(Number(draft.count) || 0)),
    }
    setGoal(next)
    saveGoal(next)
    setEditing(false)
  }

  const clear = () => {
    setGoal(EMPTY)
    saveGoal(EMPTY)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="card space-y-3">
        <p className="text-sm font-semibold text-gray-900">{t('goalSet')}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-400 font-medium">{t('goalDistance')} ({t('goalKm')})</span>
            <input
              type="number" min={0} step="0.5" inputMode="decimal"
              className="input mt-1" placeholder="0"
              value={draft.distanceKm}
              onChange={e => setDraft(d => ({ ...d, distanceKm: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 font-medium">{t('goalCount')} ({t('goalTimes')})</span>
            <input
              type="number" min={0} step="1" inputMode="numeric"
              className="input mt-1" placeholder="0"
              value={draft.count}
              onChange={e => setDraft(d => ({ ...d, count: e.target.value }))}
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">{t('goalHint')}</p>
        <div className="flex items-center gap-2">
          <button onClick={commit} className="btn-primary flex-1 py-2 text-sm">{t('goalSave')}</button>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 text-sm font-medium text-gray-500 rounded-lg border border-gray-200">
            {t('goalCancel')}
          </button>
          {p.hasGoal && (
            <button onClick={clear} className="py-2 px-3 text-sm font-medium text-red-500 rounded-lg border border-red-200">
              {t('goalClear')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">🎯 {t('goalTitle')}</p>
        <button onClick={openEditor} className="text-xs font-semibold text-primary-600">
          {p.hasGoal ? t('goalEdit') : t('goalSet')}
        </button>
      </div>

      {!p.hasGoal ? (
        <p className="text-xs text-gray-400">{t('goalNone')}</p>
      ) : (
        <div className="space-y-2.5">
          {p.achieved && (
            <p className="text-sm font-bold text-primary-600 bg-primary-50 rounded-lg py-1.5 text-center">
              {t('goalAchieved')}
            </p>
          )}
          {p.distance.active && (
            <GoalBar
              label={t('goalDistance')}
              value={formatDistance(thisWeek.distance_m)}
              goalText={`${goal.distanceKm}${t('goalKm')}`}
              pct={p.distance.pct}
              met={p.distance.met}
              sub={p.distance.met ? undefined : t('goalRemainDistance', { km: round1(p.distance.remainingM / 1000) })}
            />
          )}
          {p.count.active && (
            <GoalBar
              label={t('goalCount')}
              value={`${thisWeek.count}${t('goalTimes')}`}
              goalText={`${goal.count}${t('goalTimes')}`}
              pct={p.count.pct}
              met={p.count.met}
              sub={p.count.met ? undefined : t('goalRemainCount', { n: p.count.remaining })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function GoalBar({
  label, value, goalText, pct, met, sub,
}: { label: string; value: string; goalText: string; pct: number; met: boolean; sub?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-gray-500 font-medium">{label}</span>
        <span className="text-gray-400">
          <b className={met ? 'text-primary-600' : 'text-gray-900'}>{value}</b> / {goalText}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-primary-500' : 'bg-primary-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

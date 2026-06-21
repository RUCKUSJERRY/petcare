'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { formatDistance } from '@/lib/utils'
import { summarizeWalks, weeklyGoalProgress, type WalkGoal, type WalkLike } from '@/lib/walkStats'

const EMPTY: WalkGoal = { distanceKm: 0, count: 0 }

/** 이번 주 산책 목표(거리/횟수) 설정 + 달성률 카드. 목표는 계정(walk_goals)에 저장돼 기기 간 동기화된다. */
export function WalkGoalCard({ walks }: { walks: WalkLike[] }) {
  const t = useTranslations('walks')
  const supabase = createClient()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ distanceKm: '', count: '' })

  const { data: goal = EMPTY } = useQuery({
    queryKey: ['walk-goal'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return EMPTY
      // 마이그레이션(walk_goals) 미적용 환경에서도 안전하게 미설정으로 처리
      const { data, error } = await supabase
        .from('walk_goals')
        .select('distance_km, count')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !data) return EMPTY
      return { distanceKm: Number(data.distance_km) || 0, count: Number(data.count) || 0 }
    },
  })

  const thisWeek = summarizeWalks(walks).thisWeek
  const p = weeklyGoalProgress(thisWeek, goal)

  const openEditor = () => {
    setDraft({
      distanceKm: goal.distanceKm ? String(goal.distanceKm) : '',
      count: goal.count ? String(goal.count) : '',
    })
    setEditing(true)
  }

  const persist = async (next: WalkGoal) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('walk_goals')
        .upsert({ user_id: user.id, distance_km: next.distanceKm, count: next.count }, { onConflict: 'user_id' })
    }
    await qc.invalidateQueries({ queryKey: ['walk-goal'] })
    setSaving(false)
    setEditing(false)
  }

  const commit = () =>
    persist({
      distanceKm: Math.max(0, Number(draft.distanceKm) || 0),
      count: Math.max(0, Math.round(Number(draft.count) || 0)),
    })

  const clear = () => persist(EMPTY)

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
          <button onClick={commit} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-50">{t('goalSave')}</button>
          <button onClick={() => setEditing(false)} disabled={saving} className="flex-1 py-2 text-sm font-medium text-gray-500 rounded-lg border border-gray-200 disabled:opacity-50">
            {t('goalCancel')}
          </button>
          {p.hasGoal && (
            <button onClick={clear} disabled={saving} className="py-2 px-3 text-sm font-medium text-red-500 rounded-lg border border-red-200 disabled:opacity-50">
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

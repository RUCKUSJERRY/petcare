'use client'

import { useTranslations } from 'next-intl'
import { shiftDateTime } from '@/lib/utils'

/** 빠른 시각 조정 버튼 (베이비타임식 ±버튼) */
const QUICK_STEPS = [
  { label: '-1H', delta: -60 },
  { label: '-10분', delta: -10 },
  { label: '-1분', delta: -1 },
  { label: '+1분', delta: 1 },
  { label: '+10분', delta: 10 },
  { label: '+1H', delta: 60 },
] as const

/**
 * 기록 날짜·시각 편집기.
 * - withTime=false: 날짜(YYYY-MM-DD)만 (일정성 기록)
 * - withTime=true : 년·월·일·시·분 (datetime-local) + 빠른 ±시각 버튼 (생활기록)
 */
export function RecordDateTime({
  date, time, withTime, onChange,
}: {
  date: string
  time: string | null
  withTime: boolean
  onChange: (date: string, time: string | null) => void
}) {
  const t = useTranslations('records')

  if (!withTime) {
    return (
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('date')}</label>
        <input
          className="input" type="date" value={date}
          onChange={e => e.target.value && onChange(e.target.value, time)}
        />
      </div>
    )
  }

  const safeTime = time ?? '00:00'
  const bump = (delta: number) => {
    const r = shiftDateTime(date, safeTime, delta)
    onChange(r.date, r.time)
  }
  const onDateTime = (v: string) => {
    const [d, tm] = v.split('T')
    if (d && tm) onChange(d, tm)
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 block">{t('dateTime')}</label>
      {/* 년/월/일/시/분 — 모바일에서 네이티브 휠로 입력 */}
      <input
        className="input" type="datetime-local" value={`${date}T${safeTime}`}
        onChange={e => onDateTime(e.target.value)}
      />
      {/* 빠른 시·분 편집 */}
      <div className="grid grid-cols-6 gap-1">
        {QUICK_STEPS.map(q => (
          <button
            key={q.label} type="button" onClick={() => bump(q.delta)}
            className="py-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100"
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}

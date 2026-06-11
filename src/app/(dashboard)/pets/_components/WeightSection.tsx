'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { WeightLog } from '@/types'

export function WeightSection({ petId, defaultOpen = false }: { petId: string; defaultOpen?: boolean }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(defaultOpen)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState({
    weight_kg: '',
    measured_on: new Date().toISOString().slice(0, 10),
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['weight_logs', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('pet_id', petId)
        .order('measured_on', { ascending: true })
      return (data ?? []) as WeightLog[]
    },
  })

  const add = async () => {
    const w = parseFloat(form.weight_kg)
    if (!w || w <= 0) { setError('체중을 올바르게 입력해주세요'); return }
    setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('weight_logs').insert({
      pet_id: petId,
      weight_kg: w,
      measured_on: form.measured_on,
    })
    setSaving(false)
    if (insErr) { setError('저장에 실패했어요'); return }
    setForm({ weight_kg: '', measured_on: new Date().toISOString().slice(0, 10) })
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['weight_logs', petId] })
  }

  const remove = async (id: string) => {
    await supabase.from('weight_logs').delete().eq('id', id)
    setConfirmDeleteId(null)
    qc.invalidateQueries({ queryKey: ['weight_logs', petId] })
  }

  const latest = logs.length ? logs[logs.length - 1] : null
  const prev = logs.length > 1 ? logs[logs.length - 2] : null
  const diff = latest && prev ? +(latest.weight_kg - prev.weight_kg).toFixed(2) : null

  const reversedLogs = [...logs].reverse()
  const visibleLogs = showAll ? reversedLogs : reversedLogs.slice(0, 5)

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">체중 기록</h2>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-sm text-primary-600 font-semibold"
        >
          {adding ? '취소' : '+ 기록'}
        </button>
      </div>

      {/* 최근 체중 + 변화 */}
      {latest && (
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-primary-600">{latest.weight_kg}kg</span>
          {diff !== null && diff !== 0 && (
            <span className={`text-sm font-medium ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}kg
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">최근 측정 {latest.measured_on}</span>
        </div>
      )}

      {/* 추이 그래프 */}
      {logs.length >= 2 && <WeightChart logs={logs} />}

      {/* 추가 폼 */}
      {adding && (
        <div className="space-y-2 bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              placeholder="체중(kg)"
              value={form.weight_kg}
              onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
            />
            <input
              className="input"
              type="date"
              value={form.measured_on}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(f => ({ ...f, measured_on: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={add} disabled={saving} className="btn-primary w-full py-2 text-sm">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

      {/* 목록 */}
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">아직 기록이 없어요</p>
      ) : (
        <div className="space-y-1">
          {visibleLogs.map(log => (
            <div key={log.id} className="flex items-center text-sm py-1">
              <span className="text-gray-400 w-24">{log.measured_on}</span>
              <span className="font-medium text-gray-800">{log.weight_kg}kg</span>
              {confirmDeleteId === log.id ? (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-500">삭제할까요?</span>
                  <button
                    onClick={() => remove(log.id)}
                    className="text-xs text-red-500 font-semibold"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-gray-400"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(log.id)}
                  className="ml-auto text-xs text-gray-300 hover:text-red-500"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
          {logs.length > 5 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full text-xs text-primary-600 font-medium pt-1 hover:underline"
            >
              {showAll ? '접기' : `이전 기록 ${logs.length - 5}건 더 보기`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** 의존성 없는 SVG 체중 추이 차트 (y축 라벨·영역·기준선·최근값 강조) */
function WeightChart({ logs }: { logs: WeightLog[] }) {
  const W = 300, H = 120
  const padL = 34, padR = 10, padT = 12, padB = 20 // 좌측 y라벨/하단 날짜 여백
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const weights = logs.map(l => l.weight_kg)
  const rawMin = Math.min(...weights)
  const rawMax = Math.max(...weights)
  // 위아래 약간의 여백을 둬 선이 가장자리에 붙지 않게
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.15
  const max = rawMax + span * 0.15
  const range = max - min || 1

  const x = (i: number) => padL + (logs.length === 1 ? innerW / 2 : (i / (logs.length - 1)) * innerW)
  const y = (w: number) => padT + (1 - (w - min) / range) * innerH

  const pts = logs.map((l, i) => ({ x: x(i), y: y(l.weight_kg), w: l.weight_kg, d: l.measured_on }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

  const last = pts[pts.length - 1]
  const fmtDate = (d: string) => d.slice(5).replace('-', '.') // MM.DD

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d8a42" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2d8a42" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* y축 기준선 + 라벨 (최소/최대 실제값) */}
      {[rawMax, rawMin].map((val, i) => {
        const yy = y(val)
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{val}kg</text>
          </g>
        )
      })}

      {/* 영역 + 선 */}
      <path d={area} fill="url(#wfill)" />
      <path d={line} fill="none" stroke="#2d8a42" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* 포인트 */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 2} fill="#2d8a42" />
      ))}

      {/* 최근값 강조 라벨 */}
      <text
        x={Math.min(last.x, W - padR - 2)}
        y={Math.max(last.y - 7, padT + 7)}
        textAnchor="end"
        fontSize="10"
        fontWeight="700"
        fill="#1f6e32"
      >
        {last.w}kg
      </text>

      {/* 시작/끝 날짜 */}
      <text x={padL} y={H - 6} textAnchor="start" fontSize="9" fill="#9ca3af">{fmtDate(pts[0].d)}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="#9ca3af">{fmtDate(last.d)}</text>
    </svg>
  )
}

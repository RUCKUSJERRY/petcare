'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { WeightLog } from '@/types'

export function WeightSection({ petId }: { petId: string }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    qc.invalidateQueries({ queryKey: ['weight_logs', petId] })
  }

  const latest = logs.length ? logs[logs.length - 1] : null
  const prev = logs.length > 1 ? logs[logs.length - 2] : null
  const diff = latest && prev ? +(latest.weight_kg - prev.weight_kg).toFixed(2) : null

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
          {[...logs].reverse().slice(0, 5).map(log => (
            <div key={log.id} className="flex items-center text-sm py-1">
              <span className="text-gray-400 w-24">{log.measured_on}</span>
              <span className="font-medium text-gray-800">{log.weight_kg}kg</span>
              <button
                onClick={() => remove(log.id)}
                className="ml-auto text-xs text-gray-300 hover:text-red-500"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 의존성 없는 간단 SVG 선그래프 */
function WeightChart({ logs }: { logs: WeightLog[] }) {
  const W = 280, H = 80, pad = 8
  const weights = logs.map(l => l.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const pts = logs.map((l, i) => {
    const x = pad + (i / (logs.length - 1)) * (W - pad * 2)
    const y = H - pad - ((l.weight_kg - min) / range) * (H - pad * 2)
    return { x, y }
  })
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="#2d8a42" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#2d8a42" />
      ))}
    </svg>
  )
}

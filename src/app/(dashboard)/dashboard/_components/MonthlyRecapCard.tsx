'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { formatDistance, formatWon, isoToKstDate, todayKST, careCategoryIcon } from '@/lib/utils'
import {
  previousMonthRange, isMonthlyRecapWindow, computeMonthlyRecap, hasMonthlyRecapActivity,
} from '@/lib/monthlyRecap'
import type { RecapRecord, RecapWalk } from '@/lib/weeklyRecap'
import { shareOrDownloadImage } from '@/lib/shareImage'

/**
 * 홈 '지난달 우리 아이' 회고 카드 — 새 달 초반(1~7일)에만, 지난 한 달을 돌아보게 한다.
 * 월초 재방문 계기 + 브랜드 이미지 카드로 공유(자연 유입)를 노린다.
 * 노출 창이 아니거나 활동이 없으면 렌더하지 않아 홈을 번잡하게 하지 않는다.
 */
export function MonthlyRecapCard() {
  const t = useTranslations('monthlyRecap')
  const supabase = createClient()
  const { selectedPetId } = useSelectedPet()
  const { data: pets } = useMyPets()
  const pet = pets?.find(p => p.id === selectedPetId) ?? null

  const today = todayKST()
  const inWindow = isMonthlyRecapWindow(today)
  const range = previousMonthRange(today)
  const [sharing, setSharing] = useState(false)

  const { data } = useQuery({
    queryKey: ['monthly-recap', selectedPetId, range.startStr],
    enabled: !!selectedPetId && inWindow,
    queryFn: async () => {
      const startIso = `${range.startStr}T00:00:00+09:00`
      const endIso = `${range.endStr}T23:59:59+09:00`
      const [walksRes, recordsRes] = await Promise.all([
        supabase.from('walks').select('duration_s, distance_m, started_at')
          .eq('pet_id', selectedPetId!).gte('started_at', startIso).lte('started_at', endIso),
        supabase.from('records').select('category, cost, event_on')
          .eq('pet_id', selectedPetId!).gte('event_on', range.startStr).lte('event_on', range.endStr),
      ])
      const walkRows = (walksRes.data ?? []) as { duration_s: number; distance_m: number; started_at: string }[]
      return computeMonthlyRecap(
        walkRows.map(w => ({ duration_s: w.duration_s, distance_m: w.distance_m, dateKst: isoToKstDate(w.started_at) })) as RecapWalk[],
        (recordsRes.data ?? []) as RecapRecord[],
        range.daysInMonth,
      )
    },
  })

  if (!inWindow || !pet || !data || !hasMonthlyRecapActivity(data)) return null
  const recap = data

  const share = async () => {
    setSharing(true)
    try {
      const size = 1080
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no ctx')

      // 브랜드 그라데이션 배경
      const grad = ctx.createLinearGradient(0, 0, size, size)
      grad.addColorStop(0, '#2d8a42')
      grad.addColorStop(1, '#1f6e32')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
      ctx.textAlign = 'center'

      // 상단: N월 리포트 + 아이 이름
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '600 46px system-ui, -apple-system, sans-serif'
      ctx.fillText(t('cardMonthLabel', { month: range.month }), size / 2, 150)
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 78px system-ui, -apple-system, sans-serif'
      ctx.fillText(pet.name, size / 2, 240)

      // 중앙: 지표 4종 (2×2)
      const cells: { icon: string; label: string; value: string }[] = [
        { icon: '🦮', label: t('walks'), value: `${recap.walkCount}${t('walksUnit')}` },
        { icon: '📏', label: t('distance'), value: formatDistance(recap.distanceM) },
        { icon: '📝', label: t('records'), value: `${recap.logCount}${t('recordsUnit')}` },
        { icon: '🧾', label: t('spend'), value: formatWon(recap.spend) },
      ]
      const cx = [size * 0.3, size * 0.7]
      const cy = [size * 0.5, size * 0.72]
      cells.forEach((c, i) => {
        const x = cx[i % 2]
        const y = cy[Math.floor(i / 2)]
        ctx.font = '82px system-ui, -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
        ctx.fillText(c.icon, x, y - 40)
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 60px system-ui, -apple-system, sans-serif'
        ctx.fillText(c.value, x, y + 30)
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        ctx.font = '400 38px system-ui, -apple-system, sans-serif'
        ctx.fillText(c.label, x, y + 80)
      })

      // 하단: 함께한 날 + 브랜드
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = '500 40px system-ui, -apple-system, sans-serif'
      ctx.fillText(t('activeDays', { days: recap.activeDays }), size / 2, size * 0.9)
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '600 36px system-ui, -apple-system, sans-serif'
      ctx.fillText('🐾 펫케어', size / 2, size * 0.96)

      const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('blob fail')
      await shareOrDownloadImage(
        blob,
        'petcare-monthly.png',
        t('shareCaption', { name: pet.name, month: range.month, walks: recap.walkCount, days: recap.activeDays }),
      )
    } catch {
      // 캔버스/공유 실패 — 조용히 무시(비핵심 기능)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="card space-y-3 border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">🗓️ {t('title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{t('subtitle', { month: range.month, name: pet.name })}</p>
        </div>
        <button
          onClick={share}
          disabled={sharing}
          aria-label={t('shareAria', { month: range.month })}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full px-3 py-1.5 transition-colors disabled:opacity-60"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a2 2 0 100-4 2 2 0 000 4zM6 14a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
          {t('share')}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat icon="🦮" label={t('walks')} value={`${recap.walkCount}${t('walksUnit')}`} />
        <Stat icon="📏" label={t('distance')} value={formatDistance(recap.distanceM)} />
        <Stat icon="📝" label={t('records')} value={`${recap.logCount}${t('recordsUnit')}`} />
        <Stat icon="🧾" label={t('spend')} value={formatWon(recap.spend)} />
      </div>

      {recap.topCategory && (
        <p className="text-xs text-center text-gray-500">
          {t('topCategory', {
            icon: careCategoryIcon(recap.topCategory.category),
            category: recap.topCategory.category,
            count: recap.topCategory.count,
          })}
        </p>
      )}
      <p className="text-xs text-center text-primary-600 font-medium">{t('activeDays', { days: recap.activeDays })}</p>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white/70 rounded-xl py-2.5 px-1">
      <div className="text-lg leading-none" aria-hidden>{icon}</div>
      <div className="text-sm font-bold text-gray-900 mt-1 truncate">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5 truncate">{label}</div>
    </div>
  )
}

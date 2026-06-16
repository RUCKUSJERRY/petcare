'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Species } from '@/types'

/**
 * 일일 권장 칼로리·급여량 계산기 (수의학 표준 RER/MER 공식).
 * - RER(휴식기 에너지요구량) = 70 × 체중(kg)^0.75 kcal/일
 * - MER(일일 에너지요구량) = RER × 생애·활동 계수
 * - 급여량(g) = MER ÷ (사료 100g당 kcal ÷ 100)
 * 계수는 일반적인 권장값이며, 정확한 양은 수의사·사료 권장량을 따르세요.
 */

type FactorKey =
  | 'neutered' | 'intact' | 'weightLoss' | 'growth' | 'senior' | 'active'

// 종별 MER 계수 (성장기는 퍼피<4개월 3.0 / 그 이후 2.0의 중간값을 대표값으로 사용)
const FACTORS: Record<Species, Record<FactorKey, number>> = {
  dog: { neutered: 1.6, intact: 1.8, weightLoss: 1.0, growth: 2.5, senior: 1.4, active: 2.0 },
  cat: { neutered: 1.2, intact: 1.4, weightLoss: 0.8, growth: 2.5, senior: 1.1, active: 1.6 },
}

const FACTOR_ORDER: FactorKey[] = ['neutered', 'intact', 'active', 'growth', 'senior', 'weightLoss']

export function FeedCalculator({
  species,
  defaultWeight,
  defaultFactor = 'neutered',
}: {
  species: Species
  defaultWeight?: number | null
  defaultFactor?: FactorKey
}) {
  const t = useTranslations('feed')
  const [weight, setWeight] = useState(defaultWeight ? String(defaultWeight) : '')
  const [factor, setFactor] = useState<FactorKey>(defaultFactor)
  const [kcalPer100g, setKcalPer100g] = useState('350')
  const [meals, setMeals] = useState(2)
  const [open, setOpen] = useState(false)

  const w = parseFloat(weight)
  const density = parseFloat(kcalPer100g)
  const valid = w > 0
  const rer = valid ? 70 * Math.pow(w, 0.75) : 0
  const mer = rer * FACTORS[species][factor]
  const grams = valid && density > 0 ? (mer / density) * 100 : null
  const perMeal = grams != null && meals > 0 ? grams / meals : null

  return (
    <div className="card space-y-3 border-l-4 border-amber-400" style={{ borderRadius: '0 12px 12px 0' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 text-left">
        <span className="text-2xl shrink-0" aria-hidden>🍽️</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{t('title')}</div>
          <div className="text-xs text-gray-400 mt-0.5">{t('subtitle')}</div>
        </div>
        <span className="text-gray-400 text-sm shrink-0">{open ? t('collapse') : t('expand')}</span>
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          {/* 체중 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t('weightLabel')}</label>
            <input
              className="input" type="number" step="0.1" min="0"
              placeholder={t('weightPlaceholder')}
              value={weight} onChange={e => setWeight(e.target.value)}
            />
          </div>

          {/* 활동/생애 단계 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t('factorLabel')}</label>
            <div className="flex flex-wrap gap-1.5">
              {FACTOR_ORDER.map(key => (
                <button
                  key={key}
                  onClick={() => setFactor(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    factor === key ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {t(`factor.${key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 사료 칼로리 밀도 + 끼니 수 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t('densityLabel')}</label>
              <input
                className="input" type="number" min="1"
                value={kcalPer100g} onChange={e => setKcalPer100g(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t('mealsLabel')}</label>
              <select className="input" value={meals} onChange={e => setMeals(Number(e.target.value))}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{t('mealsN', { n })}</option>)}
              </select>
            </div>
          </div>

          {/* 결과 */}
          {valid ? (
            <div className="bg-amber-50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-500">{t('resultMer')}</span>
                <span className="text-lg font-bold text-amber-700">{Math.round(mer)} kcal/일</span>
              </div>
              {grams != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">{t('resultGrams')}</span>
                  <span className="text-lg font-bold text-amber-700">{Math.round(grams)} g/일</span>
                </div>
              )}
              {perMeal != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">{t('resultPerMeal')}</span>
                  <span className="text-sm font-semibold text-gray-700">{Math.round(perMeal)} g × {meals}{t('mealsUnit')}</span>
                </div>
              )}
              <p className="text-[11px] text-gray-400 pt-1">RER {Math.round(rer)} kcal × {FACTORS[species][factor]} ({t(`factor.${factor}`)})</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">{t('enterWeight')}</p>
          )}

          <p className="text-[11px] text-gray-400 leading-relaxed">{t('disclaimer')}</p>
        </div>
      )}
    </div>
  )
}

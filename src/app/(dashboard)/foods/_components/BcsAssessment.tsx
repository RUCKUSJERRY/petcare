'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BCS_QUESTIONS, scoreBcs, bcsOutcome, type BcsSignal } from '@/lib/bcs'

const TONE: Record<'amber' | 'green' | 'red', { card: string; badge: string }> = {
  amber: { card: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  green: { card: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800' },
  red: { card: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800' },
}

/**
 * 체형(BCS) 자가진단 — 정적 안내를 단계형 인터랙티브 진단으로.
 * 갈비뼈·허리선·복부 3문항에 답하면 저체중/이상적/과체중을 즉시 판정하고 권장 행동을 안내한다.
 * 결과는 저장하지 않는다(참고용). 순수 로직은 lib/bcs.ts 에서 계산·테스트된다.
 */
export function BcsAssessment() {
  const t = useTranslations('bcs')
  // 각 문항의 선택 신호(미응답은 undefined). step 은 현재 보여줄 문항 인덱스.
  const [answers, setAnswers] = useState<(BcsSignal | undefined)[]>(
    () => BCS_QUESTIONS.map(() => undefined),
  )
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(false)

  const answered = answers.filter((a): a is BcsSignal => a != null)
  const result = answered.length === BCS_QUESTIONS.length ? scoreBcs(answered) : null

  const reset = () => {
    setAnswers(BCS_QUESTIONS.map(() => undefined))
    setStep(0)
    setStarted(false)
  }

  const pick = (signal: BcsSignal) => {
    setAnswers(prev => {
      const next = [...prev]
      next[step] = signal
      return next
    })
    // 마지막 문항이면 결과로, 아니면 다음 문항으로.
    if (step < BCS_QUESTIONS.length - 1) setStep(step + 1)
  }

  return (
    <div className="card space-y-3 border-l-4 border-primary-400" style={{ borderRadius: '0 12px 12px 0' }}>
      <div className="flex items-center gap-2.5">
        <span className="text-2xl shrink-0" aria-hidden>⚖️</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{t('title')}</div>
          <div className="text-xs text-gray-400 mt-0.5">{t('subtitle')}</div>
        </div>
      </div>

      {/* 시작 전 */}
      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="btn-primary w-full text-sm py-2.5"
        >
          {t('start')}
        </button>
      )}

      {/* 진행 중 (결과 나오기 전) */}
      {started && !result && (
        <div className="space-y-3">
          {/* 진행 표시 */}
          <div className="flex items-center gap-1.5">
            {BCS_QUESTIONS.map((q, i) => (
              <span
                key={q.id}
                className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary-500' : i === step ? 'bg-primary-300' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-primary-600">
              {step + 1} / {BCS_QUESTIONS.length} · {BCS_QUESTIONS[step].topic}
            </p>
            <p className="text-sm font-medium text-gray-800 mt-1 flex items-start gap-1.5">
              <span aria-hidden>{BCS_QUESTIONS[step].icon}</span>
              <span>{BCS_QUESTIONS[step].question}</span>
            </p>
          </div>

          <div className="space-y-2">
            {BCS_QUESTIONS[step].options.map(opt => (
              <button
                key={opt.signal}
                type="button"
                onClick={() => pick(opt.signal)}
                className={`w-full text-left text-sm rounded-lg border px-3 py-2.5 transition-colors ${
                  answers[step] === opt.signal
                    ? 'border-primary-400 bg-primary-50 text-primary-800 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('prev')}
            </button>
          )}
        </div>
      )}

      {/* 결과 */}
      {result && (() => {
        const o = bcsOutcome(result)
        const tone = TONE[o.tone]
        return (
          <div className={`rounded-xl border p-3.5 space-y-2 ${tone.card}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>{o.icon}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tone.badge}`}>{o.title}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{o.summary}</p>
            <ul className="space-y-1 pt-0.5">
              {o.actions.map((a, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-gray-600 leading-relaxed">
                  <span className="text-primary-400 shrink-0" aria-hidden>›</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 pt-0.5">
              {t('disclaimer')}
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-primary-600 font-semibold pt-0.5"
            >
              {t('retry')}
            </button>
          </div>
        )
      })()}
    </div>
  )
}

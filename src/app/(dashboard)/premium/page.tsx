'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePlan } from '@/hooks/usePlan'
import { useAppSettings } from '@/hooks/useAppSettings'
import { formatKRW } from '@/lib/pricing'
// 서버 헬퍼(lib/toss)와 동일 규칙을 공유 순수 모듈에서 가져온다(규칙 드리프트 방지).
import { customerKeyForUser } from '@/lib/tossCustomerKey'

interface SubSummary {
  status: 'active' | 'canceled' | 'past_due'
  current_period_end: string
  card_company: string | null
  card_number_masked: string | null
  amount: number
  canceled_at: string | null
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR')

export default function PremiumPage() {
  const t = useTranslations('premium')
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()
  const supabase = createClient()
  const { isPremium } = usePlan()
  const { premiumPriceKRW: price } = useAppSettings()

  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  const { data: subData } = useQuery<{ subscription: SubSummary | null }>({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/me')
      if (!res.ok) return { subscription: null }
      return res.json()
    },
  })
  const sub = subData?.subscription ?? null

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-subscription'] })
    qc.invalidateQueries({ queryKey: ['my-plan'] })
  }

  // 카드 등록 성공 리다이렉트(?billing=success&authKey=...) → 빌링키 발급+첫 결제
  useEffect(() => {
    const billing = params.get('billing')
    if (!billing) return
    if (billing === 'fail') {
      setFlash({ kind: 'error', msg: t('failMsg') })
      router.replace('/premium')
      return
    }
    const authKey = params.get('authKey')
    if (billing === 'success' && authKey) {
      setBusy(true)
      fetch('/api/billing/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey }),
      })
        .then(async res => {
          const j = await res.json().catch(() => ({}))
          // 이미 활성 구독이면(중복 제출·재시도) 오류가 아니라 이미 프리미엄 상태다.
          if (res.ok || j?.error === 'already_subscribed') {
            setFlash({ kind: 'success', msg: t('successMsg') })
            refresh()
          } else {
            setFlash({ kind: 'error', msg: j?.message || t('failMsg') })
          }
        })
        .catch(() => setFlash({ kind: 'error', msg: t('failMsg') }))
        .finally(() => { setBusy(false); router.replace('/premium') })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subscribe = async () => {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    if (!clientKey) { setFlash({ kind: 'error', msg: t('notConfigured') }); return }
    setBusy(true)
    setFlash(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFlash({ kind: 'error', msg: t('loginRequired') }); setBusy(false); return }
      const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk')
      const toss = await loadTossPayments(clientKey)
      const customerKey = customerKeyForUser(user.id)
      const payment = toss.payment({ customerKey })
      const origin = window.location.origin
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${origin}/premium?billing=success`,
        failUrl: `${origin}/premium?billing=fail`,
        customerEmail: user.email,
      })
      // 리다이렉트되므로 이후 코드는 실행되지 않는다.
    } catch {
      setFlash({ kind: 'error', msg: t('failMsg') })
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!confirm(t('cancelConfirm'))) return
    setBusy(true)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.canceled) { setFlash({ kind: 'success', msg: t('cancelDone') }); refresh() }
      else if (res.ok) { setFlash({ kind: 'error', msg: t('cancelNoActive') }); refresh() }
      else setFlash({ kind: 'error', msg: t('failMsg') })
    } finally {
      setBusy(false)
    }
  }

  const benefits: { icon: string; key: string; ready: boolean }[] = [
    { icon: '🚫', key: 'noAds', ready: true },
    { icon: '📊', key: 'reports', ready: true },
    { icon: '🧾', key: 'ocr', ready: true },
    { icon: '👨‍👩‍👧', key: 'family', ready: false },
  ]

  // 무료 vs 프리미엄 비교 — 전환 의도를 명확히 하기 위한 표
  const compareRows: { key: string; free: string; premium: string; ready: boolean }[] = [
    { key: 'noAds', free: t('compareAdsFree'), premium: t('compareAdsPremium'), ready: true },
    { key: 'ocr', free: t('compareOcrFree'), premium: t('compareOcrPremium'), ready: true },
    { key: 'reports', free: t('compareReportsFree'), premium: t('compareReportsPremium'), ready: true },
    { key: 'family', free: t('compareFamilyFree'), premium: t('compareFamilyPremium'), ready: false },
  ]

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400" aria-label={t('back')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      {/* 히어로 */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white text-center shadow-lg">
        <div className="text-5xl mb-2" aria-hidden>👑</div>
        <div className="text-lg font-bold">{t('heroTitle')}</div>
        <p className="mt-1 text-sm text-white/80">{t('heroSubtitle')}</p>
      </div>

      {flash && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          flash.kind === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-600'
        }`}>
          {flash.msg}
        </div>
      )}

      {/* 구독 상태 */}
      {sub && (sub.status === 'active' || sub.status === 'canceled') && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              {sub.status === 'active' ? t('statusActive') : t('statusCanceled')}
            </span>
            {isPremium && <span className="text-xs text-primary-600 font-medium">👑</span>}
          </div>
          {sub.status === 'active'
            ? <p className="text-xs text-gray-500">{t('nextBilling', { date: fmtDate(sub.current_period_end) })}</p>
            : <p className="text-xs text-gray-500">{t('untilDate', { date: fmtDate(sub.current_period_end) })}</p>}
          {sub.card_company && (
            <p className="text-xs text-gray-400">
              {t('cardLabel', { company: sub.card_company, number: sub.card_number_masked ?? '' })}
            </p>
          )}
          {sub.status === 'active' && (
            <button onClick={cancel} disabled={busy} className="mt-2 text-xs text-red-500 underline underline-offset-2">
              {t('cancelBtn')}
            </button>
          )}
        </div>
      )}

      {sub?.status === 'past_due' && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {t('pastDue')}
        </div>
      )}

      {/* 혜택 */}
      <ul className="mt-5 space-y-2.5">
        {benefits.map(b => (
          <li key={b.key} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
            <span className="text-2xl shrink-0" aria-hidden>{b.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{t(`benefit.${b.key}.title`)}</div>
              <div className="text-xs text-gray-400">{t(`benefit.${b.key}.desc`)}</div>
            </div>
            {!b.ready && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
                {t('comingSoon')}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* 무료 vs 프리미엄 한눈에 비교 */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-2">{t('compareTitle')}</h2>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] text-xs">
            <div className="bg-gray-50 px-3 py-2" />
            <div className="bg-gray-50 px-2 py-2 text-center font-semibold text-gray-500">{t('compareFree')}</div>
            <div className="bg-primary-50 px-2 py-2 text-center font-bold text-primary-700">👑 {t('comparePremium')}</div>
            {compareRows.map(row => (
              <div key={row.key} className="contents">
                <div className="border-t border-gray-100 px-3 py-2.5 text-sm text-gray-700 flex items-center gap-1.5">
                  {t(`benefit.${row.key}.title`)}
                  {!row.ready && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-gray-100 text-gray-400">{t('compareSoon')}</span>
                  )}
                </div>
                <div className="border-t border-gray-100 px-2 py-2.5 text-center text-gray-400">{row.free}</div>
                <div className="border-t border-gray-100 bg-primary-50/40 px-2 py-2.5 text-center font-semibold text-primary-700">{row.premium}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 가격 + 결제 CTA (구독 중이 아닐 때) */}
      {sub?.status !== 'active' && (
        <div className="mt-6 space-y-2">
          <div className="text-center">
            <span className="text-2xl font-bold text-gray-900">₩{formatKRW(price)}</span>
            <span className="text-sm text-gray-400"> {t('perMonth')}</span>
          </div>
          <button onClick={subscribe} disabled={busy} className="btn-primary w-full py-3.5 text-base font-semibold">
            {busy ? t('processing') : sub?.status === 'past_due' ? t('resubscribe') : t('subscribeCta')}
          </button>
          <p className="text-center text-[11px] text-gray-400">{t('autoRenewNote')}</p>
        </div>
      )}

      <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">{t('disclaimer')}</p>
    </div>
  )
}

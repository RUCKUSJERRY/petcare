'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMyPets } from '@/hooks/useMyPets'
import { useTour } from '@/contexts/TourContext'

const STORAGE_KEY = 'pc-onboarding-v2'
export const OPEN_ONBOARDING_EVENT = 'pc:open-onboarding'

type Step = {
  selector?: string // 강조할 요소 (없으면 가운데 환영 카드)
  titleKey: string
  descKey: string
}

const STEPS: Step[] = [
  {
    titleKey: 'onboardingWelcomeTitle',
    descKey: 'onboardingWelcomeDesc',
  },
  {
    selector: '[data-tour="pets"]',
    titleKey: 'onboardingPetsTitle',
    descKey: 'onboardingPetsDesc',
  },
  {
    selector: '[data-tour="bell"]',
    titleKey: 'onboardingBellTitle',
    descKey: 'onboardingBellDesc',
  },
  {
    // 홈 '일정' 타일은 하단 탭과 중복이라 정리됨 — 투어는 상시 존재하는 하단 '일정' 탭을 짚는다.
    selector: '[data-tour="nav-schedule"]',
    titleKey: 'onboardingScheduleTitle',
    descKey: 'onboardingScheduleDesc',
  },
  {
    selector: '[data-tour="quick-record"]',
    titleKey: 'onboardingQuickRecordTitle',
    descKey: 'onboardingQuickRecordDesc',
  },
  {
    selector: '[data-tour="nav-more"]',
    titleKey: 'onboardingMoreTitle',
    descKey: 'onboardingMoreDesc',
  },
  {
    selector: '[data-tour="nav-community"]',
    titleKey: 'onboardingCommunityTitle',
    descKey: 'onboardingCommunityDesc',
  },
]

const PAD = 6 // 강조 영역 여백

export function OnboardingModal() {
  const t = useTranslations('ui')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const targetRef = useRef<Element | null>(null)
  const { data: pets } = useMyPets()
  const { setTourActive } = useTour()
  // 최초 자동 실행을 한 번만 판정하기 위한 가드
  const autoChecked = useRef(false)

  // 투어가 열려 있는 동안 FAB(＋기록)을 계속 띄우도록 전역 상태로 알린다.
  // (홈·아이 상세에서 숨는 FAB 때문에 '＋기록' 단계가 조용히 건너뛰어지던 문제 해결)
  useEffect(() => {
    setTourActive(open)
    return () => setTourActive(false)
  }, [open, setTourActive])

  const close = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
    setOpen(false)
  }, [])

  // 수동 다시 보기(프로필 → 앱 둘러보기)는 아이 유무와 무관하게 항상 동작한다.
  useEffect(() => {
    const reopen = () => { setStep(0); setOpen(true) }
    window.addEventListener(OPEN_ONBOARDING_EVENT, reopen)
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, reopen)
  }, [])

  // 최초 자동 실행은 '아이를 1마리 이상 등록한 뒤'에만 연다. 아이가 없으면 투어가 강조할
  // 요약카드·빠른기록 FAB·일정 타일이 아직 렌더되지 않아 대부분의 단계가 빈 화면을 가리키거나
  // 자동으로 건너뛰어, 정작 필요한 사용자에게 투어가 반쪽짜리로 보였다. 홈의 환영 히어로가
  // 등록 전 안내(첫 아이 등록 CTA)를 대신하고, 등록 직후 이 투어가 실제 기능을 짚어준다.
  useEffect(() => {
    if (autoChecked.current) return
    if (!pets || pets.length === 0) return
    autoChecked.current = true
    try { if (!localStorage.getItem(STORAGE_KEY)) setOpen(true) } catch { /* noop */ }
  }, [pets])

  // 현재 단계의 대상 요소 측정 (없으면 자동으로 다음 단계로)
  useLayoutEffect(() => {
    if (!open) return
    const s = STEPS[step]
    if (!s.selector) { targetRef.current = null; setRect(null); return }

    const el = document.querySelector(s.selector)
    if (!el) {
      // 대상이 화면에 없으면 건너뜀
      if (step < STEPS.length - 1) setStep(v => v + 1)
      else close()
      return
    }
    targetRef.current = el
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    const measure = () => {
      if (targetRef.current) setRect(targetRef.current.getBoundingClientRect())
    }
    const t = setTimeout(measure, 280)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const next = () => (last ? close() : setStep(v => v + 1))

  // 말풍선 위치 계산
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640
  const tipW = Math.min(300, vw - 32)

  let tipStyle: React.CSSProperties
  if (rect) {
    const below = rect.bottom + 12 + 160 < vh
    const top = below ? rect.bottom + 12 : Math.max(12, rect.top - 12 - 170)
    let left = rect.left + rect.width / 2 - tipW / 2
    left = Math.max(16, Math.min(left, vw - tipW - 16))
    tipStyle = { position: 'fixed', top, left, width: tipW }
  } else {
    tipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: tipW,
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      {/* 클릭 차단 백드롭 (강조 영역이 없을 때만 어둡게) */}
      <div className="absolute inset-0" style={{ background: rect ? 'transparent' : 'rgba(0,0,0,0.5)' }} />

      {/* 스포트라이트 (대상 주변만 밝게, 나머지는 어둡게) */}
      {rect && (
        <div
          className="fixed rounded-xl transition-all duration-200 pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      )}

      {/* 말풍선 */}
      <div style={tipStyle} className="bg-white rounded-2xl shadow-xl p-4" role="dialog" aria-modal="true" aria-label={t('onboardingAriaLabel')}>
        <h2 className="font-bold text-gray-900">{t(s.titleKey)}</h2>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{t(s.descKey)}</p>

        <div className="flex items-center justify-between mt-4">
          {/* 인디케이터 */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-primary-500' : 'w-1.5 bg-gray-200'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="text-sm text-gray-400 px-2 py-1.5">{t('onboardingSkip')}</button>
            <button onClick={next} className="btn-primary px-4 py-1.5 text-sm">
              {last ? t('onboardingStart') : t('onboardingNext')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

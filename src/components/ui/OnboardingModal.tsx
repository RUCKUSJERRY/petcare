'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pc-onboarding-v1'
export const OPEN_ONBOARDING_EVENT = 'pc:open-onboarding'

type Step = { emoji: string; title: string; desc: string }

const STEPS: Step[] = [
  {
    emoji: '🐾',
    title: '펫케어에 오신 걸 환영해요',
    desc: '반려동물의 음식·건강·활동 정보부터 일정 관리, 보호자 커뮤니티까지 한 곳에서 챙겨보세요.',
  },
  {
    emoji: '🐶',
    title: '우리 아이를 골라보세요',
    desc: '상단 바에서 아이를 선택하면 음식·건강·활동·일정이 모두 그 아이 기준으로 맞춤 표시돼요.',
  },
  {
    emoji: '🗓️',
    title: '건강 일정을 놓치지 마세요',
    desc: '접종·심장사상충·구충 등 예정일을 등록하면 D-day로 모아 보여주고, 알림도 받을 수 있어요.',
  },
  {
    emoji: '💬',
    title: '보호자들과 이야기 나눠요',
    desc: '커뮤니티에서 질문하고 일상을 공유하세요. 내 글에 댓글·좋아요가 달리면 알림이 와요.',
  },
]

export function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // 최초 방문 시 자동 노출
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch { /* localStorage 불가 환경 무시 */ }

    // 프로필 등에서 다시 보기 요청
    const reopen = () => { setStep(0); setOpen(true) }
    window.addEventListener(OPEN_ONBOARDING_EVENT, reopen)
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, reopen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* noop */ }
    setOpen(false)
  }

  if (!open) return null
  const last = step === STEPS.length - 1
  const s = STEPS[step]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-8 pb-6 text-center">
          <div className="text-5xl mb-4">{s.emoji}</div>
          <h2 id="onboarding-title" className="text-lg font-bold text-gray-900">{s.title}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{s.desc}</p>
        </div>

        {/* 단계 인디케이터 */}
        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary-500' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 px-6 pb-6">
          <button onClick={close} className="text-sm text-gray-400 px-3 py-2.5">
            건너뛰기
          </button>
          <button
            onClick={() => (last ? close() : setStep(s => s + 1))}
            className="btn-primary flex-1 py-2.5"
          >
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}

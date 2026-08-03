'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * 홈 상단 개인화 인사말 — 시간대(아침·낮·저녁·밤)에 맞춘 인사 + 보호자 이름.
 * 매일 돌아오는 앱인 만큼, 첫 화면에서 이름을 불러 따뜻하게 맞이해 재방문 습관을 강화한다.
 *
 * 인사말은 접속 시각(사용자 로컬)에 따라 달라지므로 클라이언트에서 판정한다
 * (SSR 서버 시각으로 굳으면 실제 시간대와 어긋날 수 있어). 하이드레이션 불일치를 피하려
 * 첫 렌더에선 이름만 쓰는 중립 인사를 보여주고, 마운트 후 시간대 인사로 바꾼다.
 */
export function HomeGreeting({ name }: { name: string | null }) {
  const t = useTranslations('dashboard')
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening' | 'night' | null>(null)

  useEffect(() => {
    const h = new Date().getHours()
    setSlot(h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night')
  }, [])

  const icon = slot === 'morning' ? '☀️' : slot === 'afternoon' ? '🌤️' : slot === 'evening' ? '🌆' : slot === 'night' ? '🌙' : '🐾'
  const greeting = slot ? t(`greet_${slot}`) : t('greetDefault')

  return (
    <div className="flex items-center gap-2">
      <span className="text-xl" aria-hidden>{icon}</span>
      <p className="text-base font-bold text-gray-900">
        {name ? t('greetWithName', { name, greeting }) : greeting}
      </p>
    </div>
  )
}

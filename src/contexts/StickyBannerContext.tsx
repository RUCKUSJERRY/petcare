'use client'

import { createContext, useContext, useState } from 'react'

/**
 * 하단 고정 제휴 배너(StickyAffiliateBanner)의 노출 여부를 앱 전역에서 공유한다.
 *
 * 배너와 '＋기록' 플로팅 버튼(QuickRecordFab)은 둘 다 화면 하단(내비게이션 위)에 fixed 로
 * 떠 있어, 배너가 보이는 화면(음식·건강·활동·생활관리 가이드)에서는 FAB이 배너의 가격·닫기(✕)
 * 영역을 덮어 가린다. 배너가 자신이 보이는지를 이 컨텍스트로 알리면, FAB이 그때만 위로 올라가
 * 겹침을 피한다. (배너는 페이지 콘텐츠 안, FAB은 레이아웃에 있어 Provider 로 둘을 함께 감싼다.)
 */
const StickyBannerContext = createContext<{
  visible: boolean
  setVisible: (v: boolean) => void
}>({ visible: false, setVisible: () => {} })

export function StickyBannerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  return (
    <StickyBannerContext.Provider value={{ visible, setVisible }}>
      {children}
    </StickyBannerContext.Provider>
  )
}

export function useStickyBanner() {
  return useContext(StickyBannerContext)
}

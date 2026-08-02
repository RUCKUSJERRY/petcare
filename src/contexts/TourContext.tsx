'use client'

import { createContext, useContext, useState } from 'react'

/**
 * 온보딩 '앱 둘러보기' 투어가 진행 중인지를 앱 전역에서 공유한다.
 *
 * 투어의 '＋기록' 단계는 [data-tour="quick-record"] (플로팅 FAB)를 스포트라이트로 짚는다.
 * 그런데 이 FAB은 홈(아이 선택 시)·아이 상세 화면에서는 인라인 기록 UI와 중복이라 숨긴다
 * (QuickRecordFab 참고). 최초 투어는 첫 아이 등록 직후 바로 이 화면들에서 열리므로, FAB이
 * 없어 해당 단계가 조용히 건너뛰어졌다 — 정작 앱의 핵심 동작(원탭 기록)을 새 사용자가 한 번도
 * 안내받지 못했다. 투어가 열려 있는 동안에는 FAB을 계속 띄워 이 단계가 실제로 노출되게 한다.
 * (투어가 끝나면 다시 원래대로 숨는다.)
 */
const TourContext = createContext<{
  tourActive: boolean
  setTourActive: (v: boolean) => void
}>({ tourActive: false, setTourActive: () => {} })

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tourActive, setTourActive] = useState(false)
  return (
    <TourContext.Provider value={{ tourActive, setTourActive }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}

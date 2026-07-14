'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'petcare_selected_pet'

type Ctx = {
  selectedPetId: string | null
  setSelectedPetId: (id: string | null) => void
  /** localStorage 복원이 끝났는지. SSR/첫 페인트(=false)에는 선택 의존 UI를 확정하지 말 것. */
  hydrated: boolean
}

const SelectedPetContext = createContext<Ctx>({
  selectedPetId: null,
  setSelectedPetId: () => {},
  hydrated: false,
})

export function SelectedPetProvider({ children }: { children: React.ReactNode }) {
  const [selectedPetId, setState] = useState<string | null>(null)
  // SSR·첫 클라이언트 렌더는 선택값을 모른다(localStorage 는 클라이언트 전용). 복원 전에는
  // false → 선택 의존 화면(홈 요약카드·FAB)이 "선택 없음"을 먼저 그렸다가 뒤집히는 깜빡임을
  // 막기 위해, 소비자가 이 플래그로 확정 시점을 기다리게 한다.
  const [hydrated, setHydrated] = useState(false)

  // 마운트 시 localStorage에서 복원
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setState(stored)
    setHydrated(true)
  }, [])

  const setSelectedPetId = (id: string | null) => {
    setState(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <SelectedPetContext.Provider value={{ selectedPetId, setSelectedPetId, hydrated }}>
      {children}
    </SelectedPetContext.Provider>
  )
}

export const useSelectedPet = () => useContext(SelectedPetContext)

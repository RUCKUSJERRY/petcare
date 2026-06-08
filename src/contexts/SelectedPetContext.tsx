'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'petcare_selected_pet'

type Ctx = {
  selectedPetId: string | null
  setSelectedPetId: (id: string | null) => void
}

const SelectedPetContext = createContext<Ctx>({
  selectedPetId: null,
  setSelectedPetId: () => {},
})

export function SelectedPetProvider({ children }: { children: React.ReactNode }) {
  const [selectedPetId, setState] = useState<string | null>(null)

  // 마운트 시 localStorage에서 복원
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setState(stored)
  }, [])

  const setSelectedPetId = (id: string | null) => {
    setState(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <SelectedPetContext.Provider value={{ selectedPetId, setSelectedPetId }}>
      {children}
    </SelectedPetContext.Provider>
  )
}

export const useSelectedPet = () => useContext(SelectedPetContext)

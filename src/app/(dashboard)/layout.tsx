import { BottomNav } from '@/components/ui/BottomNav'
import { PetSwitcher } from '@/components/ui/PetSwitcher'
import { Suspense } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-lg mx-auto pb-20">
        <Suspense fallback={null}>
          <PetSwitcher />
        </Suspense>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

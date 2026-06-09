import { BottomNav } from '@/components/ui/BottomNav'
import { AppHeader } from '@/components/ui/AppHeader'
import { OnboardingModal } from '@/components/ui/OnboardingModal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-lg mx-auto pb-20">
        {children}
      </main>
      <BottomNav />
      <OnboardingModal />
    </div>
  )
}

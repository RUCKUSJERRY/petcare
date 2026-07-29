import { BottomNav } from '@/components/ui/BottomNav'
import { AppHeader } from '@/components/ui/AppHeader'
import { OnboardingModal } from '@/components/ui/OnboardingModal'
import { QuickRecordFab } from '@/components/ui/QuickRecordFab'
import { StickyBannerProvider } from '@/contexts/StickyBannerContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // 하단 고정 배너 노출 여부를 FAB이 알 수 있도록 Provider 로 콘텐츠와 FAB을 함께 감싼다.
    <StickyBannerProvider>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-lg mx-auto pb-20">
          {children}
        </main>
        <QuickRecordFab />
        <BottomNav />
        <OnboardingModal />
      </div>
    </StickyBannerProvider>
  )
}

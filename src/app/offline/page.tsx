export const metadata = { title: '오프라인 - 펫케어' }

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-lg font-bold text-gray-900">오프라인 상태예요</h1>
      <p className="text-sm text-gray-500 mt-2">
        인터넷 연결을 확인한 뒤 다시 시도해주세요.
      </p>
    </div>
  )
}

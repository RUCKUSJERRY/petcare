import Link from 'next/link'

/**
 * 전역 404 화면 — 존재하지 않는 경로/삭제된 리소스로 접근했을 때.
 * 예전엔 Next.js 기본 404가 노출됐다. 앱 톤에 맞춰 홈으로 돌아갈 경로를 제공한다.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="text-center max-w-sm space-y-3">
        <div className="text-5xl" aria-hidden>🐕</div>
        <p className="text-lg font-bold text-gray-900">페이지를 찾을 수 없어요</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          주소가 바뀌었거나 삭제된 페이지일 수 있어요.
        </p>
        <div className="pt-2">
          <Link href="/dashboard" className="btn-primary text-sm inline-block">
            홈으로 가기
          </Link>
        </div>
      </div>
    </div>
  )
}

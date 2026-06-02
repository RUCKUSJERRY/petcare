export const metadata = {
  title: '서비스 연결 오류 - 펫케어',
}

export default function ServiceUnavailablePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🐾</div>
        <h1 className="text-xl font-bold text-gray-900">
          서버에 연결할 수 없어요
        </h1>
        <p className="text-gray-500 mt-3 text-sm leading-relaxed">
          데이터베이스 서버가 응답하지 않고 있어요.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
        <p className="text-gray-400 mt-2 text-xs">
          (백엔드 일시정지 또는 점검 중일 수 있습니다)
        </p>

        <a
          href="/"
          className="inline-block mt-8 px-6 py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
        >
          다시 시도
        </a>
      </div>
    </div>
  )
}

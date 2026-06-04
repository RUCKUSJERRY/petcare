import Link from 'next/link'

const sections = [
  {
    href: '/foods',
    icon: '🥩',
    title: '음식 가이드',
    desc: '우리 아이가 먹어도 되는 음식, 위험한 음식',
    accent: 'bg-red-50',
  },
  {
    href: '/health',
    icon: '🏥',
    title: '건강 가이드',
    desc: '나이에 맞는 검진·백신·질환 정보',
    accent: 'bg-blue-50',
  },
  {
    href: '/walk',
    icon: '🦮',
    title: '산책 가이드',
    desc: '견종과 나이별 적정 운동량과 팁',
    accent: 'bg-green-50',
  },
]

export default function InfoPage() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">정보</h1>
        <p className="text-sm text-gray-500 mt-1">
          우리 아이 맞춤 음식·건강·산책 정보를 확인하세요
        </p>
      </div>

      <div className="space-y-3">
        {sections.map(s => (
          <Link key={s.href} href={s.href} className="block">
            <div className="card flex items-center gap-4 active:scale-[0.99] transition-transform">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.accent}`}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{s.title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{s.desc}</div>
              </div>
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

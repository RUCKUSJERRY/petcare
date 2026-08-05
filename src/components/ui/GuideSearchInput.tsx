'use client'

/**
 * 정보 가이드(건강·생활관리·활동) 상단의 키워드 검색 입력.
 *
 * 예전엔 가이드가 전부 인라인 카드로만 나열돼, 한 번 읽은 정보를 다시 찾으려면 매번 스크롤해야
 * 했다(음식만 검색 지원). 각 정보 화면 상단에 이 입력을 두어 키워드로 바로 좁혀볼 수 있게 한다
 * (정보를 다시 찾는 이유 → 체류·재방문). 음식 검색과 동일한 ✕ 즉시 초기화 패턴을 따른다.
 */
export function GuideSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel = '지우기',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  clearLabel?: string
}) {
  return (
    <div className="relative">
      <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
      <input
        className="input pl-9 pr-9"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

'use client'

/**
 * 공용 온/오프 스위치 버튼 — 앱 전반의 토글 UI(푸시 구독·알림 채널 등)에서 재사용한다.
 * 예전엔 PushToggle·PrefPushToggle 이 동일한 스위치 마크업을 각자 복붙해 갖고 있었다.
 * 색·크기·핸들 애니메이션을 한 곳에 두어 일관성을 보장한다(접근성: aria-pressed + aria-label).
 */
export function Switch({
  enabled,
  onToggle,
  disabled = false,
  ariaLabel,
}: {
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-primary-500' : 'bg-gray-300'} disabled:opacity-60`}
      aria-pressed={enabled}
      aria-label={ariaLabel}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

import { BackButton } from './BackButton'

/**
 * 하위 페이지용 헤더. 뒤로가기 버튼 + 제목.
 * 정보 탭의 음식/건강/활동 페이지 등에서 사용.
 * 히스토리가 없을 때의 기본 폴백은 홈(/dashboard) — 예전 기본값 /info 허브는 폐지됨.
 */
export function PageHeader({ title, fallbackHref = '/dashboard' }: { title: string; fallbackHref?: string }) {
  return (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref={fallbackHref} />
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
    </div>
  )
}

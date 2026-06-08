import { BackButton } from './BackButton'

/**
 * 하위 페이지용 헤더. 뒤로가기 버튼 + 제목.
 * 정보 탭의 음식/건강/활동 페이지 등에서 사용.
 */
export function PageHeader({ title, fallbackHref = '/info' }: { title: string; fallbackHref?: string }) {
  return (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref={fallbackHref} />
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
    </div>
  )
}

import { redirect } from 'next/navigation'

// 정보 허브는 각 하위 페이지(음식·건강·활동·생활관리) 상단의 SectionTabs 스트립과 중복이라
// 대표 페이지(음식 가이드)로 넘긴다. 하단탭 '정보'는 이제 /foods 로 바로 진입하며, 이 라우트는
// 예전 링크·뒤로가기 폴백·북마크가 여전히 동작하도록 리다이렉트로만 남겨둔다.
export default function InfoPage() {
  redirect('/foods')
}

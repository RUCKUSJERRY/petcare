# 펫케어 🐾

반려동물 견종·나이 맞춤 건강 정보 웹 서비스

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.local.example .env.local
```
`.env.local`을 열어 Supabase와 카카오맵 키를 입력하세요.

- Supabase: https://supabase.com/dashboard → 프로젝트 생성 → Settings > API
- 카카오맵: https://developers.kakao.com → 내 애플리케이션 → 앱 키 > JavaScript 키
  - `플랫폼 > Web`에 서비스 도메인(예: http://localhost:3000)을 등록하고, `Kakao Map`·`Local`(장소 검색) API를 활성화해야 지도 기능이 동작합니다.

### 3. Supabase DB 초기화
Supabase 대시보드 → SQL Editor에서 `supabase/init.sql` 전체를 복사해 실행하세요.
이후 `supabase/migrations/` 안의 SQL을 번호 순서대로 실행해 최신 스키마를 맞춥니다.
(예: 지도 즐겨찾기는 `018_map_favorites.sql` 실행이 필요합니다. 각 파일은 idempotent라 재실행해도 안전합니다.)

### 4. Supabase Google 로그인 설정
Supabase 대시보드 → Authentication → Providers → Google 활성화
Google Cloud Console에서 OAuth 클라이언트 ID 발급 후 입력

### 5. 로컬 서버 실행
```bash
npm run dev
```
http://localhost:3000 에서 확인

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/login/        # 로그인 페이지
│   ├── (dashboard)/         # 메인 서비스 (인증 필요)
│   │   ├── dashboard/       # 홈
│   │   ├── foods/           # 음식 안전 정보
│   │   ├── health/          # 건강 가이드
│   │   ├── walk/            # 산책 가이드
│   │   └── pets/new/        # 반려동물 등록
│   └── auth/callback/       # OAuth 콜백
├── components/ui/           # 공통 UI 컴포넌트
├── lib/
│   ├── supabase/            # Supabase 클라이언트
│   └── utils.ts             # 유틸 함수
└── types/                   # TypeScript 타입 정의
```

## 기술 스택
- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL, Auth, Storage)
- **Tailwind CSS**
- **React Query** (서버 상태 관리)
- **TypeScript**

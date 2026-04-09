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
`.env.local`을 열어 Supabase와 Anthropic API 키를 입력하세요.

- Supabase: https://supabase.com/dashboard → 프로젝트 생성 → Settings > API
- Anthropic: https://console.anthropic.com → API Keys

### 3. Supabase DB 초기화
Supabase 대시보드 → SQL Editor에서 `supabase/init.sql` 전체를 복사해 실행하세요.

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

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
(예: 지도 즐겨찾기는 `018_map_favorites.sql`, 진료 기록은 `019_medical_records.sql`, 산책 기록은 `020_walks.sql` 실행이 필요합니다. 각 파일은 idempotent라 재실행해도 안전합니다.)

### 4. Supabase Google 로그인 설정
Supabase 대시보드 → Authentication → Providers → Google 활성화
Google Cloud Console에서 OAuth 클라이언트 ID 발급 후 입력

### 5. 로컬 서버 실행
```bash
npm run dev
```
http://localhost:3000 에서 확인

## 📱 모바일 앱처럼 사용하기 (PWA 설치)

이 서비스는 **PWA(설치형 웹앱)** 로 구성되어 있어, 스토어 등록 없이도 휴대폰 홈 화면에 추가하면
전체화면(주소창 없음)으로 일반 앱처럼 실행되며 푸시 알림·오프라인을 지원합니다.

### 휴대폰에서 설치

- **Android (Chrome)**: 사이트 접속 → 우측 상단 메뉴(⋮) → **앱 설치 / 홈 화면에 추가**
- **iOS (Safari)**: 사이트 접속 → 공유 버튼(□↑) → **홈 화면에 추가**
  - iOS는 Safari에서만 설치가 가능하며, 푸시 알림은 "홈 화면에 추가" 후 실행한 상태에서 동작합니다.

### 로컬 개발 서버를 휴대폰에서 접속해 테스트하기

PC와 휴대폰을 **같은 Wi‑Fi**에 연결한 뒤:

1. PC에서 LAN IP로 개발 서버를 실행
   ```bash
   npm run dev -- -H 0.0.0.0
   ```
2. PC의 내부 IP 확인 (예: `192.168.0.10`)
   - macOS/Linux: `ifconfig` 또는 `ip addr` / Windows: `ipconfig`
3. 휴대폰 브라우저에서 `http://<PC-IP>:3000` 접속
   - 카카오맵을 쓰려면 카카오 개발자 콘솔 `플랫폼 > Web` 도메인에 해당 주소도 등록해야 합니다.
   - PWA 설치/푸시 등 일부 기능은 보안 컨텍스트(HTTPS)가 필요하므로, 폰에서 완전한 PWA 동작을 보려면
     배포본(예: Vercel HTTPS 도메인)으로 접속하는 것을 권장합니다.

> 정식 스토어(App Store / Play) 입점이 필요해지면, 동일한 웹 코드를 그대로 **Capacitor**로 래핑해
> 네이티브 앱으로 패키징할 수 있습니다. 이 경우에도 **브라우저 PWA 사용은 그대로 유지**됩니다.

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

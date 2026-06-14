# 모바일 앱 / 스토어 입점 검토 노트

> 작성: 2026-06-14 · 상태: **검토만 완료, 구현 보류 (입점 준비 시점에 착수)**
>
> 이 문서는 펫케어를 모바일 앱(App Store / Play)으로 내보내기 위한 사전 검토 기록이다.
> 당장 진행하지 않기로 했으며, 실제 입점이 필요해질 때 Phase 2부터 이어서 진행하면 된다.

---

## 0. 현재 상태 (별도 작업 없이 가능한 것)

이 서비스는 이미 **PWA(설치형 웹앱)** 로 구성되어 있다.
- `src/app/manifest.ts` (standalone·아이콘·테마), `public/sw.js` (서비스워커), `public/apple-touch-icon.png`
- 즉, 휴대폰에서 **"홈 화면에 추가"** 하면 전체화면 앱처럼 실행되고 푸시·오프라인을 지원한다.
- 설치 방법은 `README.md`의 "📱 모바일 앱처럼 사용하기 (PWA 설치)" 섹션 참고.

→ "지금 폰에서 앱처럼 써보기"는 **추가 개발 없이 가능**. 스토어 입점만 별도 작업이다.

---

## 1. 왜 스토어 입점인가

- App Store / Play 등재는 **신뢰 신호**(검색 노출, 리뷰·별점, 설치 경험, iOS 푸시 안정성)로 작동.
- 단, **앱을 처음부터 다시 만들 필요는 없다** — 기존 웹 코드를 그대로 래핑하면 된다.

---

## 2. Capacitor vs React Native

| | **Capacitor** | **React Native** |
|---|---|---|
| 정체 | 웹앱(현재 Next.js)을 **네이티브 셸(WebView)** 에 담는 래퍼 | JS로 작성하되 **네이티브 UI**로 렌더링하는 별도 프레임워크 |
| 기존 코드 재사용 | **거의 100%** | **사실상 0% (전면 재작성)** |
| 성능/네이티브 감성 | 일반 앱 수준 (이 앱엔 충분) | 최상 (고프레임 UI·게임에 유리) |
| 코드베이스 | 웹/앱 **1개** 유지 | 웹 + 앱 **2개** 유지 |
| 업데이트 배포 | 대부분 **웹 배포(Vercel)만으로 즉시 반영**, 네이티브 변경 시에만 스토어 심사 | 변경 시 **매번 스토어 심사**(또는 CodePush 등 별도 인프라) |
| 학습/투입 비용 | 낮음 | 높음 |

**결론: 콘텐츠·폼 위주인 이 앱은 Capacitor가 운영비·업데이트 민첩성에서 유리. RN 재작성은 비권장.**

---

## 3. ⚠️ 핵심 구조 이슈 (반드시 기억할 것)

이 앱은 **정적 export형 Capacitor가 아니다.**

- 미들웨어 기반 **인증**(`src/middleware.ts`), **서버 액션**(`*/_actions.ts`),
  **API 라우트**(`/api/push/*`, `/api/medical/ocr`), **SSR**을 적극 사용한다.
- 따라서 `output: 'export'`로 정적 추출하면 위 기능이 전부 깨진다.

→ 이 앱에 맞는 방식: **Capacitor 셸이 배포된 HTTPS 사이트(Vercel)를 로드** (`server.url` 방식)
- ✅ SSR·인증·서버액션·API 그대로 동작
- ✅ 웹 배포만으로 앱 내용도 즉시 업데이트 (스토어 재심사 최소화)
- ✅ 브라우저/PWA 사용도 그대로 유지
- ⚠️ **HTTPS 배포 도메인이 먼저 있어야** Capacitor 설정 확정 가능

---

## 4. 입점 단계별 로드맵

### Phase 0 — 계정·준비물 (저장소 밖, 사용자)
| 항목 | 비고 |
|---|---|
| Apple Developer Program | $99/년 (iOS 제출 필수) |
| Google Play Console | $25 1회 |
| macOS + Xcode | iOS 빌드·서명·제출은 macOS에서만 가능 |
| Android Studio | Android 빌드/서명 |
| 개인정보처리방침 URL, 앱 아이콘, 스토어 스크린샷·설명 | 심사 제출물 |

### Phase 1 — HTTPS 배포 기반 확보 (선행 필수)
- Vercel 등에 배포해 안정적 HTTPS 도메인 확보 (`vercel.json` 이미 존재)
- Supabase Auth redirect URL, 카카오 플랫폼 도메인에 해당 도메인 등록

### Phase 2 — Capacitor 도입 (저장소 작업)
- `@capacitor/core`·`@capacitor/cli`·`@capacitor/ios`·`@capacitor/android` 추가
- `capacitor.config.ts` 생성 (`appId`, `appName`, `server.url = HTTPS 도메인`)
- `npx cap add android` / `npx cap add ios` (네이티브 프로젝트 생성)
- 푸시/카메라 등 네이티브 플러그인 검토 (현재 web-push·웹 파일 업로드 사용 중)

### Phase 3 — 네이티브 빌드·서명 (로컬 macOS/Android Studio 필요)
- 아이콘·스플래시 생성, 권한 설명(iOS `Info.plist`, Android 매니페스트)
- iOS: Xcode 서명 → TestFlight 내부 테스트
- Android: keystore 서명 → AAB 빌드

### Phase 4 — 스토어 제출·심사
- App Store Connect / Play Console 메타데이터·스크린샷·개인정보 입력 후 제출
- ⚠️ **Apple 심사 가이드 4.2 (최소 기능)**: 단순 웹 래퍼는 반려 가능.
  이 앱은 **푸시 알림 + 카메라/사진(OCR)** 등 기기 기능을 쓰므로 이를 네이티브로 연동하면 통과에 유리.

---

## 5. 착수 시 먼저 정해야 할 입력값

1. **`appId` (번들 ID)** — 역도메인 형식. 예: `com.petcare.app` 또는 보유 도메인 기반
2. **`appName`** — 스토어/홈 표시 이름 (예: `펫케어`)
3. **`server.url` 로 쓸 HTTPS 배포 도메인** — Vercel 배포 도메인

---

## 6. FAQ

- **Q. Capacitor를 도입하면 PWA/브라우저 사용은 못 하나?**
  A. 아니다. 같은 웹 코드베이스를 공유하므로 **브라우저 접속·PWA 설치는 그대로 유지**되고,
  네이티브 앱이 "추가로" 배포되는 구조다.

- **Q. 앱 업데이트할 때마다 스토어 심사를 받아야 하나?**
  A. `server.url` 방식에서는 대부분의 화면/기능 변경이 **웹 배포만으로 반영**된다.
  네이티브 플러그인·셸 자체를 바꿀 때만 스토어 재심사가 필요하다.

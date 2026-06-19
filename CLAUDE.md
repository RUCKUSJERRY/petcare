# CLAUDE.md

이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트

펫케어(petcare) — Next.js 14 (App Router) + Supabase(PostgreSQL/Auth/Storage) 기반 반려동물 관리 웹앱.
i18n은 next-intl(`messages/ko.json`), 상태/데이터는 TanStack Query, 지도는 카카오맵.

## 명령어

- `npm run dev` 개발 서버 · `npm run build` 프로덕션 빌드
- `npm run lint` ESLint · `npm test` Vitest
- `npm run db:build` `supabase/02_final/` → `supabase/01_operation/01.1_initial/00_full_setup.sql` 통합본 재생성

## Supabase SQL 작업 규칙 (중요)

DB 오브젝트는 `supabase/` 의 정해진 구조로만 관리한다. **전체 규칙은 `supabase/README.md` 를 반드시 읽고 따른다.** 요약:

- **`supabase/02_final/` 이 단일 진실원천.** 오브젝트 1개 = 파일 1개, 유형별 폴더
  (`02.1_table` / `02.2_index_fk` / `02.3_function` / `02.4_trigger` / `02.5_view` / `02.6_policy` / `02.7_data` / `02.8_storage` / `02.9_config`).
- DB 변경 시:
  1. `supabase/01_operation/01.2_changes/NNN_설명.sql` 에 변경분 추가 (idempotent)
  2. **같은 변경을 `02_final/` 의 해당 오브젝트 파일에도 반영** (둘을 항상 함께 갱신)
  3. `npm run db:build` 실행
- `01_operation/01.1_initial/00_full_setup.sql` 은 **자동 생성물 — 직접 수정 금지.**
- 모든 SQL은 idempotent(재실행 안전)하게 작성한다.

## Git 작업 규칙

- 작업은 날짜 브랜치(`YYYYMMDD`, 예: `20260618`)에서 진행한다.
- 보고 → 사용자 확인 → main 병합 흐름. 이전 날짜 브랜치가 남아있으면 당일 작업은 SKIP.

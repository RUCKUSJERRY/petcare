# Supabase SQL 관리 규칙

DB 오브젝트(SQL)를 일관되게 관리하기 위한 폴더/작업 규칙입니다.
**다른 세션에서 작업하더라도 반드시 이 규칙을 따르세요.** (요약본은 루트 `CLAUDE.md` 참고)

## 폴더 구조

```
supabase/
├─ 01_operation/                 # 운영 관점: 세팅본 + 변경분
│  ├─ 01.1_initial/              # 신규 DB 세팅용 통합 스냅샷
│  │  └─ 00_full_setup.sql       #   ⚠ 자동 생성물 — 직접 수정 금지
│  └─ 01.2_changes/              # 이 baseline 이후의 변경 SQL (운영 중 누적)
│     └─ 001_*.sql, 002_*.sql ...
├─ 02_final/                     # 오브젝트의 "현재 최종 상태" (사람이 관리하는 단일 진실원천)
│  ├─ 02.1_table/      <table>.sql        # CREATE TABLE (컬럼·PK·CHECK·UNIQUE). FK는 여기 두지 않음
│  ├─ 02.2_index_fk/   <table>.sql        # FK(ALTER ADD) + 인덱스
│  ├─ 02.3_function/   <function>.sql     # 함수
│  ├─ 02.4_trigger/    <table>.sql        # 트리거
│  ├─ 02.5_view/       <view>.sql         # 뷰
│  ├─ 02.6_policy/     <table>.sql        # RLS enable + 정책
│  ├─ 02.7_data/       <table>.sql        # 기준/시드 데이터 (사용자 데이터 아님)
│  ├─ 02.8_storage/    storage.sql        # 스토리지 버킷 + storage.objects 정책
│  └─ 02.9_config/     config.sql         # realtime publication·grant·extension 등
├─ build.mjs                     # 02_final → 01.1_initial 통합본 생성기
└─ README.md                     # (이 파일)
```

## 핵심 원칙

1. **`02_final/` 이 단일 진실원천(Source of Truth)이다.**
   오브젝트의 현재 상태는 항상 `02_final/` 을 보면 알 수 있어야 한다.
2. **오브젝트 1개 = 파일 1개.** 유형(table/index_fk/function/...)별 폴더로 나눈다.
   테이블에 딸린 인덱스/FK/정책/트리거는 "그 테이블 이름의 파일"로 각 유형 폴더에 둔다.
3. **모든 SQL은 idempotent(재실행 안전)** 하게 작성한다.
   `create table if not exists`, `create index if not exists`, `create or replace function/view`,
   `drop policy if exists` → `create policy`, `drop trigger if exists` → `create trigger`,
   FK는 `drop constraint if exists` 후 add(또는 guarded block).
4. **카테고리 번호(02.1→02.9)가 곧 실행 순서.** 폴더 안 파일은 알파벳 순으로 이어붙여지므로
   테이블 생성 순서에 의존하면 안 된다. (그래서 FK를 02.2로 분리)
5. **`01.1_initial/00_full_setup.sql` 은 자동 생성물.** 직접 수정하지 말고
   `02_final/` 를 고친 뒤 `npm run db:build` 로 다시 만든다.

## 작업 흐름 (DB 변경이 생길 때)

1. **변경 SQL을 `01.2_changes/`에 추가한다.**
   파일명: `NNN_간단설명.sql` (3자리 일련번호, 직전 번호+1). idempotent하게 작성.
2. **같은 변경을 `02_final/`의 해당 오브젝트 파일에도 반영한다.**
   (예: `pets`에 컬럼 추가 → `02.1_table/pets.sql` 수정. 새 인덱스 → `02.2_index_fk/pets.sql`)
   → 이 두 곳을 **항상 함께** 갱신해야 `02_final`이 실제 DB와 어긋나지 않는다.
3. `npm run db:build` 로 통합본을 재생성한다.

> 변경 시 `01.2_changes` 와 `02_final` 을 함께 고치는 것이 이 규칙의 가장 중요한 약속이다.
> (둘이 어긋나면 `02_final`을 정본으로 본다.)

## 새 DB 세팅 방법

1. `01_operation/01.1_initial/00_full_setup.sql` 전체를 Supabase SQL Editor에 붙여넣어 실행.
2. (이미 baseline 이후 변경이 쌓였다면) `01_operation/01.2_changes/`의 파일을 번호 순서대로 실행.

## 주기적 re-baseline (선택)

`01.2_changes` 가 너무 쌓이면, `02_final` 기준으로 다시 빌드한 통합본을 새 baseline으로 삼고
`01.2_changes` 를 비운다. (현재 `00_full_setup.sql` 이 항상 최신 `02_final` 을 반영하므로 자연스럽게 가능)

-- ============================================================
--  025: 통합 기록 모델 (records) — "구글 캘린더형" 단일 모델
--
--  설계: 공통 컬럼(records) + 카테고리별 상세 테이블(3종).
--   · 캘린더/목록은 records 공통 컬럼만 조회 → 가볍고 빠름
--   · 상세 진입 시에만 해당 상세 테이블을 join/조회
--   · 반복주기(recur_interval_days)는 선택 — null이면 1회성 일정
--   · 장소(place_*)는 카카오 장소검색 결과(상호명+좌표)를 저장
--
--  기존 vaccination_records / medical_records 는 이 모델로 대체하며,
--  데이터가 적어 별도 이전 없이 폐기한다(요청에 따라). 원치 않으면
--  파일 하단의 DROP 두 줄을 주석 처리하세요.
--
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
--  RLS는 022의 멤버십 헬퍼(is_pet_member)를 재사용합니다.
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. records : 공통 기록 (캘린더·목록의 기준)
-- ───────────────────────────────────────────────
create table if not exists public.records (
  id                   uuid primary key default gen_random_uuid(),
  pet_id               uuid not null references public.pets(id) on delete cascade,
  category             text not null check (category in (
                         '접종','심장사상충','구충','외부기생충','건강검진','진료',
                         '미용','양치','발톱','목욕','귀청소','식사','간식','기타'
                       )),
  title                text not null,                       -- 제목·항목명(진료면 진단/주제)
  event_on             date not null default current_date,  -- 시행/진료/발생일
  place_name           text,                                -- 장소(상호명)
  place_lat            double precision,                    -- 카카오 좌표(선택)
  place_lng            double precision,
  cost                 integer check (cost is null or cost >= 0),
  memo                 text,
  photo_url            text,                                -- 영수증/처방전 등(pet-photos 버킷)
  recur_interval_days  integer check (recur_interval_days is null or recur_interval_days > 0),
  next_due_on          date,                                -- 다음 예정일(반복/수동)
  last_reminded_on     date,                                -- 푸시 중복 방지
  created_at           timestamptz not null default now()
);
create index if not exists idx_records_pet_event on public.records (pet_id, event_on desc);
create index if not exists idx_records_pet_due   on public.records (pet_id, next_due_on);

alter table public.records enable row level security;
drop policy if exists "records_member_select" on public.records;
drop policy if exists "records_member_insert" on public.records;
drop policy if exists "records_member_update" on public.records;
drop policy if exists "records_member_delete" on public.records;
create policy "records_member_select" on public.records for select using (public.is_pet_member(pet_id));
create policy "records_member_insert" on public.records for insert with check (public.is_pet_member(pet_id));
create policy "records_member_update" on public.records for update using (public.is_pet_member(pet_id));
create policy "records_member_delete" on public.records for delete using (public.is_pet_member(pet_id));

-- ───────────────────────────────────────────────
-- 2. 카테고리별 상세 (record_id = records.id, 1:1)
-- ───────────────────────────────────────────────

-- 진료
create table if not exists public.record_medical (
  record_id   uuid primary key references public.records(id) on delete cascade,
  reason      text,   -- 증상 / 내원 사유
  treatment   text,   -- 처치 / 치료
  medication  text    -- 처방약
);

-- 미용
create table if not exists public.record_grooming (
  record_id   uuid primary key references public.records(id) on delete cascade,
  method      text,   -- 직접 / 업체
  vendor      text,   -- 업체명
  groom_type  text    -- 미용 종류
);

-- 식사 / 간식
create table if not exists public.record_meal (
  record_id   uuid primary key references public.records(id) on delete cascade,
  food_kind   text,   -- 종류(건사료/습식/화식 등)
  mix         text,   -- 혼합 구성
  amount      text    -- 양
);

-- 상세 RLS: 부모 records 의 반려동물 멤버십으로 검사
do $$
declare tbl text;
begin
  foreach tbl in array array['record_medical','record_grooming','record_meal']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "%s_select" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_insert" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_update" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_delete" on public.%I', tbl, tbl);
    execute format($f$create policy "%1$s_select" on public.%1$I for select
      using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)))$f$, tbl);
    execute format($f$create policy "%1$s_insert" on public.%1$I for insert
      with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)))$f$, tbl);
    execute format($f$create policy "%1$s_update" on public.%1$I for update
      using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)))$f$, tbl);
    execute format($f$create policy "%1$s_delete" on public.%1$I for delete
      using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)))$f$, tbl);
  end loop;
end $$;

-- ───────────────────────────────────────────────
-- 3. 구 테이블 폐기 (데이터 이전 없이 — 요청에 따름)
--    보존을 원하면 아래 두 줄을 주석 처리하세요.
-- ───────────────────────────────────────────────
drop table if exists public.medical_records cascade;
drop table if exists public.vaccination_records cascade;

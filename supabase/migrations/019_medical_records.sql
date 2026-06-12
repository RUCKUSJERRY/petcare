-- ============================================================
--  019: 진료 기록 (병원 방문 이력)
--  접종/구충 등 주기성 관리(vaccination_records)와 별개로,
--  일반 병원 진료(증상·진단·처치·처방·비용)를 시간순으로 남긴다.
--  내 계정(클라우드)에 저장되므로 이사·병원 변경 시에도 그대로 조회/공유 가능.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.medical_records (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  visited_on    date not null default current_date,  -- 진료일
  clinic        text,                                 -- 병원명
  reason        text,                                 -- 내원 사유 / 증상
  diagnosis     text,                                 -- 진단명
  treatment     text,                                 -- 처치 / 치료
  medication    text,                                 -- 처방약
  cost          integer check (cost is null or cost >= 0),  -- 비용(원)
  next_visit_on date,                                 -- 다음 내원 예정일
  note          text,
  photo_url     text,                                 -- 처방전 / 영수증 등 사진(pet-photos 버킷)
  created_at    timestamptz not null default now()
);

create index if not exists idx_medical_pet on public.medical_records (pet_id, visited_on desc);

alter table public.medical_records enable row level security;

-- 본인 반려동물의 기록만 (pets 소유권으로 검사)
drop policy if exists "medical_owner_select" on public.medical_records;
drop policy if exists "medical_owner_insert" on public.medical_records;
drop policy if exists "medical_owner_update" on public.medical_records;
drop policy if exists "medical_owner_delete" on public.medical_records;
create policy "medical_owner_select" on public.medical_records for select
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "medical_owner_insert" on public.medical_records for insert
  with check (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "medical_owner_update" on public.medical_records for update
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "medical_owner_delete" on public.medical_records for delete
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));

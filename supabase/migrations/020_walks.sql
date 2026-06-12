-- ============================================================
--  020: 산책 기록 + 경로 공유
--  러닝앱처럼 산책의 시작/종료 시각, 소요시간, 거리, 경로(좌표 배열)를 저장.
--  is_public = true 로 공유하면 다른 사용자도 좋은 산책로/오프리쉬존으로 조회 가능.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.walks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  pet_id      uuid references public.pets(id) on delete set null,  -- 함께 산책한 아이(선택)
  title       text,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  duration_s  integer not null check (duration_s >= 0),  -- 소요 시간(초)
  distance_m  integer not null check (distance_m >= 0),  -- 이동 거리(미터)
  path        jsonb   not null default '[]'::jsonb,      -- [[lat,lng], ...] 경로 좌표
  is_public   boolean not null default false,            -- 경로 공유 여부
  area_text   text,                                      -- 대략 지역/출발지명
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_walks_user on public.walks (user_id, started_at desc);
create index if not exists idx_walks_public on public.walks (created_at desc) where is_public;

alter table public.walks enable row level security;

drop policy if exists "walks_select" on public.walks;
drop policy if exists "walks_insert_own" on public.walks;
drop policy if exists "walks_update_own" on public.walks;
drop policy if exists "walks_delete_own" on public.walks;

-- 조회: 본인 기록 전체 + 공유(is_public)된 기록은 모두에게
create policy "walks_select" on public.walks for select
  using (auth.uid() = user_id or is_public = true);
-- 생성/수정/삭제: 본인 것만
create policy "walks_insert_own" on public.walks for insert
  with check (auth.uid() = user_id);
create policy "walks_update_own" on public.walks for update
  using (auth.uid() = user_id);
create policy "walks_delete_own" on public.walks for delete
  using (auth.uid() = user_id);

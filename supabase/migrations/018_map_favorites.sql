-- ============================================================
--  018: 지도 즐겨찾기 (동물병원/애견카페/동반식당)
--  카카오 장소검색 결과를 사용자 계정에 저장해 기기 간 동기화.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.map_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  place_id    text not null,                 -- 카카오 장소 id
  place_name  text not null,
  category    text,                          -- hospital | cafe | restaurant
  address     text,
  phone       text,
  lat         double precision not null,
  lng         double precision not null,
  place_url   text,                          -- 카카오맵 상세 URL
  created_at  timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists idx_map_fav_user on public.map_favorites (user_id, created_at desc);

alter table public.map_favorites enable row level security;
drop policy if exists "map_fav_select_own" on public.map_favorites;
drop policy if exists "map_fav_insert_own" on public.map_favorites;
drop policy if exists "map_fav_delete_own" on public.map_favorites;
create policy "map_fav_select_own" on public.map_favorites for select using (auth.uid() = user_id);
create policy "map_fav_insert_own" on public.map_favorites for insert with check (auth.uid() = user_id);
create policy "map_fav_delete_own" on public.map_favorites for delete using (auth.uid() = user_id);

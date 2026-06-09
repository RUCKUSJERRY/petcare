-- ============================================================
--  017: 실종 반려동물 제보
--  지도 기반 실종 신고 + 목격 제보(댓글).
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.lost_pets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text,
  species     text not null check (species in ('dog', 'cat')),
  breed_id    uuid references public.breeds(id) on delete set null,
  gender      text check (gender in ('수컷', '암컷')),
  photo_url   text,
  lost_at     date not null default current_date,
  lat         double precision not null,
  lng         double precision not null,
  area_text   text,                 -- 지오코딩된 주소(예: 강남구 역삼동)
  description text,                  -- 특징/메모
  contact     text,                 -- 연락처
  contact_public boolean not null default true,
  status      text not null default 'active' check (status in ('active', 'found')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_lost_status_created on public.lost_pets (status, created_at desc);

alter table public.lost_pets enable row level security;
drop policy if exists "lost_select" on public.lost_pets;
drop policy if exists "lost_insert_own" on public.lost_pets;
drop policy if exists "lost_update_own" on public.lost_pets;
drop policy if exists "lost_delete_own" on public.lost_pets;
create policy "lost_select"     on public.lost_pets for select using (true);
create policy "lost_insert_own" on public.lost_pets for insert with check (auth.uid() = user_id);
create policy "lost_update_own" on public.lost_pets for update using (auth.uid() = user_id);
create policy "lost_delete_own" on public.lost_pets for delete using (auth.uid() = user_id);

drop trigger if exists trg_touch_lost on public.lost_pets;
create trigger trg_touch_lost before update on public.lost_pets
  for each row execute function public.touch_updated_at();

-- 목격 제보 (댓글)
create table if not exists public.lost_pet_sightings (
  id          uuid primary key default gen_random_uuid(),
  lost_pet_id uuid not null references public.lost_pets(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  lat         double precision,     -- 목격 위치(선택)
  lng         double precision,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sighting_lost on public.lost_pet_sightings (lost_pet_id, created_at);

alter table public.lost_pet_sightings enable row level security;
drop policy if exists "sighting_select" on public.lost_pet_sightings;
drop policy if exists "sighting_insert_own" on public.lost_pet_sightings;
drop policy if exists "sighting_delete_own" on public.lost_pet_sightings;
create policy "sighting_select"     on public.lost_pet_sightings for select using (true);
create policy "sighting_insert_own" on public.lost_pet_sightings for insert with check (auth.uid() = user_id);
create policy "sighting_delete_own" on public.lost_pet_sightings for delete using (auth.uid() = user_id);

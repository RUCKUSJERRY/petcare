-- lost_pet_sightings : 실종 반려동물 목격 제보 (댓글)
create table if not exists public.lost_pet_sightings (
  id          uuid primary key default gen_random_uuid(),
  lost_pet_id uuid not null,
  user_id     uuid not null,
  content     text not null check (char_length(content) between 1 and 1000),
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

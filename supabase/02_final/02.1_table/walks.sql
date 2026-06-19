-- walks : 산책 기록 + 경로 공유
create table if not exists public.walks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  pet_id      uuid,
  title       text,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  duration_s  integer not null check (duration_s >= 0),
  distance_m  integer not null check (distance_m >= 0),
  path        jsonb   not null default '[]'::jsonb,
  is_public   boolean not null default false,
  area_text   text,
  note        text,
  like_count  int not null default 0,
  photo_url   text,
  created_at  timestamptz not null default now()
);

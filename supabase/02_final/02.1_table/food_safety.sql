-- food_safety : 음식별·종별 안전도 (개/고양이 분리)
create table if not exists public.food_safety (
  id           uuid primary key default gen_random_uuid(),
  food_id      uuid not null,
  species      text not null check (species in ('dog','cat')),
  safety_level text not null check (safety_level in ('safe','caution','dangerous')),
  reason       text,
  caution      text,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (food_id, species)
);

-- health_guides : 건강 가이드 (종/견종/크기/나이 범위별)
create table if not exists public.health_guides (
  id            uuid primary key default gen_random_uuid(),
  breed_id      uuid,                                          -- null = 공통
  size_category text check (size_category in ('소형','중형','대형')),
  species       text not null default 'dog' check (species in ('dog','cat')),
  age_month_min int not null,
  age_month_max int not null,
  category      text not null,
  title         text not null,
  description   text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint chk_health_scope check (not (breed_id is not null and size_category is not null)),
  constraint chk_health_age   check (age_month_min <= age_month_max)
);

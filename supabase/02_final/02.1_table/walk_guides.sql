-- walk_guides : 활동 가이드 (산책/놀이/훈련 등, 종/견종/크기/나이 범위별)
create table if not exists public.walk_guides (
  id            uuid primary key default gen_random_uuid(),
  breed_id      uuid,                                          -- null = 공통
  size_category text check (size_category in ('소형','중형','대형')),
  species       text not null default 'dog' check (species in ('dog','cat')),
  age_month_min int not null,
  age_month_max int not null,
  daily_minutes int not null,
  intensity     text not null check (intensity in ('가벼움', '보통', '활발')),
  tips          text,
  activity_type text not null default '산책',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint chk_walk_scope   check (not (breed_id is not null and size_category is not null)),
  constraint chk_walk_age      check (age_month_min <= age_month_max),
  constraint chk_walk_minutes  check (daily_minutes > 0)
);

-- walk_goals : 사용자별 주간 산책 목표 (거리 km · 횟수). 사용자당 1행, 0 = 미설정.
create table if not exists public.walk_goals (
  user_id      uuid primary key,
  distance_km  numeric not null default 0 check (distance_km >= 0),
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now()
);

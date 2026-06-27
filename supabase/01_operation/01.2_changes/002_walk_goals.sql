-- walk_goals: 사용자별 주간 산책 목표(거리 km · 횟수)를 계정 단위로 저장.
-- 기존에는 기기(localStorage)에만 저장돼 기기 간 동기화가 안 됐던 것을 DB로 옮긴다.
-- 사용자당 1행(PK user_id), 0 = 미설정. RLS로 본인 것만 접근.

-- 1) 테이블
create table if not exists public.walk_goals (
  user_id      uuid primary key,
  distance_km  numeric not null default 0 check (distance_km >= 0),
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now()
);

-- 2) 외래키
alter table public.walk_goals drop constraint if exists walk_goals_user_id_fkey;
alter table public.walk_goals add constraint walk_goals_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 3) RLS
alter table public.walk_goals enable row level security;
drop policy if exists "walk_goals_select_own" on public.walk_goals;
drop policy if exists "walk_goals_insert_own" on public.walk_goals;
drop policy if exists "walk_goals_update_own" on public.walk_goals;
create policy "walk_goals_select_own" on public.walk_goals for select using (auth.uid() = user_id);
create policy "walk_goals_insert_own" on public.walk_goals for insert with check (auth.uid() = user_id);
create policy "walk_goals_update_own" on public.walk_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_walk_goals on public.walk_goals;
create trigger trg_touch_walk_goals before update on public.walk_goals
  for each row execute function public.touch_updated_at();

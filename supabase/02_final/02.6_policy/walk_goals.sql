-- walk_goals : RLS (본인 목표만 조회/생성/수정)
alter table public.walk_goals enable row level security;
drop policy if exists "walk_goals_select_own" on public.walk_goals;
drop policy if exists "walk_goals_insert_own" on public.walk_goals;
drop policy if exists "walk_goals_update_own" on public.walk_goals;
create policy "walk_goals_select_own" on public.walk_goals for select using (auth.uid() = user_id);
create policy "walk_goals_insert_own" on public.walk_goals for insert with check (auth.uid() = user_id);
create policy "walk_goals_update_own" on public.walk_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

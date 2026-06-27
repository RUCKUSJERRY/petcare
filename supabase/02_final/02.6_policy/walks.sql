-- walks : RLS (본인 기록 + 공유 기록 조회, 본인만 생성/수정/삭제)
alter table public.walks enable row level security;
drop policy if exists "walks_select" on public.walks;
drop policy if exists "walks_insert_own" on public.walks;
drop policy if exists "walks_update_own" on public.walks;
drop policy if exists "walks_delete_own" on public.walks;
create policy "walks_select" on public.walks for select
  using (auth.uid() = user_id or is_public = true);
create policy "walks_insert_own" on public.walks for insert
  with check (auth.uid() = user_id);
create policy "walks_update_own" on public.walks for update
  using (auth.uid() = user_id);
create policy "walks_delete_own" on public.walks for delete
  using (auth.uid() = user_id);

-- lost_pets : RLS (공개 읽기, 본인만 작성/수정/삭제)
alter table public.lost_pets enable row level security;
drop policy if exists "lost_select" on public.lost_pets;
drop policy if exists "lost_insert_own" on public.lost_pets;
drop policy if exists "lost_update_own" on public.lost_pets;
drop policy if exists "lost_delete_own" on public.lost_pets;
create policy "lost_select"     on public.lost_pets for select using (true);
create policy "lost_insert_own" on public.lost_pets for insert with check (auth.uid() = user_id);
create policy "lost_update_own" on public.lost_pets for update using (auth.uid() = user_id);
create policy "lost_delete_own" on public.lost_pets for delete using (auth.uid() = user_id);

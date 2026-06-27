-- post_likes : RLS (공개 읽기, 본인 좋아요만 생성/삭제)
alter table public.post_likes enable row level security;
drop policy if exists "read_likes"       on public.post_likes;
drop policy if exists "insert_own_like"  on public.post_likes;
drop policy if exists "delete_own_like"  on public.post_likes;
create policy "read_likes"      on public.post_likes for select using (true);
create policy "insert_own_like" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "delete_own_like" on public.post_likes for delete using (auth.uid() = user_id);

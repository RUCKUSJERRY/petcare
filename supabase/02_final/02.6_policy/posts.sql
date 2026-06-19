-- posts : RLS (공개 읽기, 본인 글만 작성/수정/삭제)
alter table public.posts enable row level security;
drop policy if exists "read_posts"        on public.posts;
drop policy if exists "insert_own_post"   on public.posts;
drop policy if exists "update_own_post"   on public.posts;
drop policy if exists "delete_own_post"   on public.posts;
create policy "read_posts"      on public.posts for select using (true);
create policy "insert_own_post" on public.posts for insert with check (auth.uid() = user_id);
create policy "update_own_post" on public.posts for update using (auth.uid() = user_id);
create policy "delete_own_post" on public.posts for delete using (auth.uid() = user_id);

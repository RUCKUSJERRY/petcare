-- comments : RLS (공개 읽기, 본인 댓글 작성/수정/삭제)
alter table public.comments enable row level security;
drop policy if exists "read_comments"        on public.comments;
drop policy if exists "insert_own_comment"   on public.comments;
drop policy if exists "update_own_comment"   on public.comments;
drop policy if exists "delete_own_comment"   on public.comments;
create policy "read_comments"      on public.comments for select using (true);
create policy "insert_own_comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "update_own_comment" on public.comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_comment" on public.comments for delete using (auth.uid() = user_id);

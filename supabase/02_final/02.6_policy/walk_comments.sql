-- walk_comments : RLS (공유/본인 산책에만 댓글 조회·생성, 본인 댓글만 삭제)
alter table public.walk_comments enable row level security;
drop policy if exists "walk_comments_select"     on public.walk_comments;
drop policy if exists "walk_comments_insert_own" on public.walk_comments;
drop policy if exists "walk_comments_delete_own" on public.walk_comments;
create policy "walk_comments_select" on public.walk_comments for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_insert_own" on public.walk_comments for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_delete_own" on public.walk_comments for delete
  using (auth.uid() = user_id);

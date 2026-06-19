-- walk_likes : RLS (공유/본인 산책에만 좋아요 조회·생성, 본인 좋아요만 삭제)
alter table public.walk_likes enable row level security;
drop policy if exists "walk_likes_select"     on public.walk_likes;
drop policy if exists "walk_likes_insert_own" on public.walk_likes;
drop policy if exists "walk_likes_delete_own" on public.walk_likes;
create policy "walk_likes_select" on public.walk_likes for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_insert_own" on public.walk_likes for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_delete_own" on public.walk_likes for delete
  using (auth.uid() = user_id);

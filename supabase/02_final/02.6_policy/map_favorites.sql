-- map_favorites : RLS (본인 즐겨찾기만 조회/생성/삭제)
alter table public.map_favorites enable row level security;
drop policy if exists "map_fav_select_own" on public.map_favorites;
drop policy if exists "map_fav_insert_own" on public.map_favorites;
drop policy if exists "map_fav_delete_own" on public.map_favorites;
create policy "map_fav_select_own" on public.map_favorites for select using (auth.uid() = user_id);
create policy "map_fav_insert_own" on public.map_favorites for insert with check (auth.uid() = user_id);
create policy "map_fav_delete_own" on public.map_favorites for delete using (auth.uid() = user_id);

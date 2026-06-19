-- walk_guides : RLS + 공개 읽기 정책
alter table public.walk_guides enable row level security;
drop policy if exists "walk_guides 공개 읽기" on public.walk_guides;
create policy "walk_guides 공개 읽기" on public.walk_guides for select using (true);

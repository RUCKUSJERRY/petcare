-- health_guides : RLS + 공개 읽기 정책
alter table public.health_guides enable row level security;
drop policy if exists "health_guides 공개 읽기" on public.health_guides;
create policy "health_guides 공개 읽기" on public.health_guides for select using (true);

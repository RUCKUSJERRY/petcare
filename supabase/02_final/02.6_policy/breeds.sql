-- breeds : RLS + 공개 읽기 정책
alter table public.breeds enable row level security;
drop policy if exists "breeds 공개 읽기" on public.breeds;
create policy "breeds 공개 읽기" on public.breeds for select using (true);

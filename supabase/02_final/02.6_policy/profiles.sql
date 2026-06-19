-- profiles : RLS (공개 읽기, 본인만 수정)
alter table public.profiles enable row level security;
drop policy if exists "read_profiles"  on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;
create policy "read_profiles"       on public.profiles for select using (true);
create policy "update_own_profile"  on public.profiles for update using (auth.uid() = id);

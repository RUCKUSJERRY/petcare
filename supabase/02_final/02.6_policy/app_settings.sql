-- app_settings : RLS (공개 읽기, 관리자만 쓰기)
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read"   on public.app_settings;
drop policy if exists "app_settings_insert"  on public.app_settings;
drop policy if exists "app_settings_update"  on public.app_settings;
create policy "app_settings_read"   on public.app_settings for select using (true);
create policy "app_settings_insert" on public.app_settings for insert with check (public.is_admin());
create policy "app_settings_update" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- 관리자 페이지 기반: admin_users + is_admin() + app_settings(가격·광고 토글)
-- profiles.is_admin 컬럼 대신 별도 테이블로 권한 상승 위험을 차단한다. 모두 idempotent.

-- 1) admin_users (서버 전용)
create table if not exists public.admin_users (
  user_id    uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users drop constraint if exists admin_users_user_id_fkey;
alter table public.admin_users add constraint admin_users_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.admin_users enable row level security;

-- 2) is_admin() : 관리자 여부 (security definer → RLS 우회 조회)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- 3) app_settings : 운영 설정 키-값 (공개 읽기, 관리자만 쓰기)
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read"   on public.app_settings;
drop policy if exists "app_settings_insert"  on public.app_settings;
drop policy if exists "app_settings_update"  on public.app_settings;
create policy "app_settings_read"   on public.app_settings for select using (true);
create policy "app_settings_insert" on public.app_settings for insert with check (public.is_admin());
create policy "app_settings_update" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- 4) 기본값 + 초기 관리자 시드
insert into public.app_settings (key, value) values
  ('premium_price_krw', '3900'),
  ('ads_enabled', 'true')
on conflict (key) do nothing;

insert into public.admin_users (user_id)
select id from auth.users where email = 'yongjun5645@gmail.com'
on conflict (user_id) do nothing;

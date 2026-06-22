-- profiles : 사용자 표시 정보 (auth.users 1:1)
create table if not exists public.profiles (
  id            uuid primary key,
  display_name  text not null,
  avatar_url    text,
  plan          text not null default 'free' check (plan in ('free', 'premium')),
  premium_until timestamptz,
  created_at    timestamptz not null default now()
);

-- 기존 테이블 보강 (재실행 안전) — 요금제(plan)·프리미엄 만료일(premium_until)
-- plan='premium' 이고 premium_until 이 미래(또는 null=무기한)이면 프리미엄으로 본다.
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists premium_until timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'premium'));
  end if;
end $$;

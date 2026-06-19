-- profiles : 사용자 표시 정보 (auth.users 1:1)
create table if not exists public.profiles (
  id           uuid primary key,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

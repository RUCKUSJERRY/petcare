-- ============================================================
--  014: 웹 푸시 구독 저장
--  사용자별 브라우저 푸시 구독(endpoint + 키)을 저장.
--  발송은 서버(서비스 롤)에서 수행하므로 본인은 자기 구독만 관리.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_sub_select_own" on public.push_subscriptions;
drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_select_own" on public.push_subscriptions for select
  using (auth.uid() = user_id);
create policy "push_sub_insert_own" on public.push_subscriptions for insert
  with check (auth.uid() = user_id);
create policy "push_sub_delete_own" on public.push_subscriptions for delete
  using (auth.uid() = user_id);

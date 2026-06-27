-- 프리미엄 정기결제(토스 빌링) 기반: subscriptions + payments
-- billing_key 등 결제수단 토큰 보호를 위해 두 테이블 모두 서버(service_role) 전용으로 둔다.
-- (RLS on + 정책 미정의 → anon/authenticated 접근 차단). 모두 idempotent.

-- 1) subscriptions: 사용자당 1행
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique,
  status             text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  billing_key        text not null,
  customer_key       text not null,
  card_company       text,
  card_number_masked text,
  amount             integer not null check (amount >= 0),
  current_period_end timestamptz not null,
  canceled_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_subscriptions_renew on public.subscriptions (status, current_period_end);

alter table public.subscriptions enable row level security;

drop trigger if exists trg_touch_subscriptions on public.subscriptions;
create trigger trg_touch_subscriptions before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- 2) payments: 결제 이력 (order_id 멱등키)
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  order_id     text not null unique,
  payment_key  text,
  amount       integer not null check (amount >= 0),
  status       text not null default 'DONE',
  method       text,
  kind         text not null default 'initial' check (kind in ('initial', 'renewal')),
  created_at   timestamptz not null default now()
);

alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_payments_user on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

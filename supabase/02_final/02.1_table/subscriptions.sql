-- subscriptions : 프리미엄 정기결제(토스 빌링) 구독. 사용자당 1행.
-- billing_key(결제수단 토큰)는 민감정보 → RLS로 클라이언트 접근을 전면 차단하고
-- 서버(service_role)에서만 읽고 쓴다. (정책 미정의 = 서버 전용)
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

-- payments : 결제 이력 (첫 결제 + 매월 자동결제). 분석/정산·중복결제 방지용.
-- order_id 는 멱등키(같은 주문 중복 승인 방지). 서버 전용(RLS 정책 미정의).
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

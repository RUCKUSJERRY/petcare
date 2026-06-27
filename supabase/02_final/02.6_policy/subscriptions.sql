-- subscriptions : RLS (서버 전용)
-- billing_key 등 결제수단 토큰을 보호하기 위해 클라이언트 직접 접근을 전면 차단한다.
-- RLS를 켜고 정책을 만들지 않으면 anon/authenticated는 어떤 행도 읽고 쓸 수 없고,
-- service_role(서버 라우트)만 접근한다. 구독 상태 표시는 /api/billing/me 가 대신 제공.
alter table public.subscriptions enable row level security;

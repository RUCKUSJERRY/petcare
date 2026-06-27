-- payments : RLS (서버 전용)
-- 결제 이력은 서버(service_role)에서만 적재/조회한다. 정책 미정의 = 클라이언트 차단.
alter table public.payments enable row level security;

-- admin_users : RLS (서버 전용). 정책 미정의 → anon/authenticated 접근 차단.
-- 관리자 여부 확인은 security definer 함수 is_admin() 으로 우회 조회한다.
alter table public.admin_users enable row level security;

-- is_admin : 현재 사용자가 관리자인지 (RLS 헬퍼 + 클라이언트 rpc 용)
-- security definer 라 RLS로 막힌 admin_users 를 우회 조회한다.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

-- admin_users : 관리자 계정 (운영자만). 서버/SQL로만 관리하며 RLS로 클라이언트 접근 차단.
-- 권한 상승 방지를 위해 profiles.is_admin 컬럼 대신 별도 테이블로 분리한다.
create table if not exists public.admin_users (
  user_id    uuid primary key,
  created_at timestamptz not null default now()
);

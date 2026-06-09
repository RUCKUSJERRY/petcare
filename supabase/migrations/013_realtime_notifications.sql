-- ============================================================
--  013: notifications 테이블을 Realtime 발행 목록에 추가
--  (recipient RLS가 그대로 적용되어 본인 알림만 수신)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

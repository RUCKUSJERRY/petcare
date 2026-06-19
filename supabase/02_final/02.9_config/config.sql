-- config : Realtime 발행 등록 등 신규 DB 부가 설정
-- notifications 테이블을 Realtime 발행 목록에 추가 (재실행 안전)
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

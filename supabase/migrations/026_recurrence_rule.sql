-- ============================================================
--  026: 반복 규칙 고도화 (구글 캘린더형)
--  기존 recur_interval_days(정수, "N일마다")를 recur_rule(text, JSON 직렬화)로 대체.
--  매주 요일 / 매월 N일 / 매월 N째주 요일 / 매년 등 다양한 규칙을 표현.
--  ※ 025 실행 후에 실행하세요. (idempotent)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- ============================================================

alter table public.records
  add column if not exists recur_rule text;

-- 기존 "N일마다" 값이 있으면 새 규칙(JSON)으로 이관 후 옛 컬럼 제거
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'records' and column_name = 'recur_interval_days'
  ) then
    update public.records
      set recur_rule = json_build_object('freq', 'day', 'interval', recur_interval_days)::text
      where recur_interval_days is not null and recur_rule is null;
    alter table public.records drop column recur_interval_days;
  end if;
end $$;

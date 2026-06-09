-- ============================================================
--  015: 건강 일정 리마인더 발송 추적
--  같은 날 중복 푸시를 막기 위해 마지막 리마인더 발송일 기록.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

alter table public.vaccination_records
  add column if not exists last_reminded_on date;

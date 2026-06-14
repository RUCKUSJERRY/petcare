-- ============================================================
--  023: 관리 기록 카테고리 확장 (생활 관리 포함)
--  기존 건강 관리(접종·구충 등)에 미용·양치·발톱·목욕·귀청소 추가.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

alter table public.vaccination_records
  drop constraint if exists vaccination_records_category_check;

alter table public.vaccination_records
  add constraint vaccination_records_category_check
  check (category in (
    '접종', '심장사상충', '구충', '외부기생충', '건강검진',
    '미용', '양치', '발톱', '목욕', '귀청소',
    '기타'
  ));

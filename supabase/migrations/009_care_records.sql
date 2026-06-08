-- ============================================================
--  009: 접종 기록 → 건강 관리 기록으로 일반화
--  심장사상충약·구충·외부기생충·건강검진 등 주기적 건강 관리를 포괄
--
--  - vaccination_records 테이블명은 유지(참조/RLS 보존)하고 category 추가
--  - vaccine_name 컬럼은 '항목명'으로 의미 확장 (예: 하트가드, 넥스가드)
--  - 기존 데이터는 모두 '접종'으로 분류됨 (default)
-- ============================================================

alter table public.vaccination_records
  add column if not exists category text not null default '접종'
  check (category in ('접종', '심장사상충', '구충', '외부기생충', '건강검진', '기타'));

-- 다음 예정일 기준 조회 최적화 (대시보드 D-day 알림)
create index if not exists idx_vacc_due on public.vaccination_records (pet_id, next_due_on);

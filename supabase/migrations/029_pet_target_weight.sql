-- ============================================================
--  029: 목표 체중(다이어트/관리 목표) 컬럼 추가
--  체중 추이 그래프에 목표선을 표시하고, 목표까지 남은 양을 보여주기 위함.
--  null = 목표 미설정. (idempotent)
-- ============================================================

alter table public.pets
  add column if not exists target_weight_kg float
  check (target_weight_kg is null or target_weight_kg > 0);

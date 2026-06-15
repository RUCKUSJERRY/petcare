-- ============================================================
--  024: 산책 기록 사진 첨부
--  산책 종료 후 찍은 사진을 기록과 함께 영구 저장하기 위한 컬럼.
--  (Supabase Storage 의 public URL 을 저장. 버킷은 기존 pet-photos 재사용)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

alter table public.walks add column if not exists photo_url text;

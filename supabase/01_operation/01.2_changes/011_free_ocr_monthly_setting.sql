-- 무료 사용자 월 AI(OCR) 인식 무료 제공 횟수 설정 추가.
--  - 무료: 월 free_ocr_monthly 회까지 AI 인식, 초과 시 무료 인식(Tesseract) 폴백
--  - 프리미엄: 무제한(시간당 남용 방지 한도만 적용)
-- 없을 때만 삽입 → 관리자가 바꾼 값은 보존. idempotent(재실행 안전).
insert into public.app_settings (key, value) values
  ('free_ocr_monthly', '5')
on conflict (key) do nothing;

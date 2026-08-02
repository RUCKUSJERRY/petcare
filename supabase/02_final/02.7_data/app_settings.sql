-- app_settings : 기본값 시드 (없을 때만 삽입 → 관리자가 바꾼 값은 보존)
insert into public.app_settings (key, value) values
  ('premium_price_krw', '3900'),
  ('ads_enabled', 'true'),
  ('ad_cooldown_min', '3'),
  ('upsell_dismiss_min', '1440'),
  ('banner_dismiss_min', '1440'),
  ('free_ocr_monthly', '5'),
  ('anniversary_push_active', 'true')
on conflict (key) do nothing;

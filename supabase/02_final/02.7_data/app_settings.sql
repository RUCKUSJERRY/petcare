-- app_settings : 기본값 시드 (없을 때만 삽입 → 관리자가 바꾼 값은 보존)
insert into public.app_settings (key, value) values
  ('premium_price_krw', '3900'),
  ('ads_enabled', 'true')
on conflict (key) do nothing;

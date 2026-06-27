-- 프리미엄 업셀 카드·제휴 배너의 "닫은 뒤 재노출 간격(분)"을 관리자가 조절할 수 있도록
-- app_settings 기본값 추가. 없으면 코드 기본값(1440분=24h)으로 동작하므로 기능상 필수는 아님.
insert into public.app_settings (key, value) values
  ('upsell_dismiss_min', '1440'),
  ('banner_dismiss_min', '1440')
on conflict (key) do nothing;

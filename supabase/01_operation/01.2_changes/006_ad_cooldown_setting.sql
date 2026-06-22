-- 광고 최소 간격(쿨다운)을 관리자가 조절할 수 있도록 app_settings 기본값 추가.
-- 분 단위. 없으면 코드 기본값(3분)으로 동작하므로 기능상 필수는 아니지만 기본 행을 심어 둔다.
insert into public.app_settings (key, value) values
  ('ad_cooldown_min', '3')
on conflict (key) do nothing;

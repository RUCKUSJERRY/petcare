-- app_settings : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings before update on public.app_settings
  for each row execute function public.touch_updated_at();

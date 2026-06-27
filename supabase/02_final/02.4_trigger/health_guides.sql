-- health_guides : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_health_guides on public.health_guides;
create trigger trg_touch_health_guides before update on public.health_guides
  for each row execute function public.touch_updated_at();

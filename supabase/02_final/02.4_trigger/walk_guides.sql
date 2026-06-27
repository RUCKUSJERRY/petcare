-- walk_guides : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_walk_guides on public.walk_guides;
create trigger trg_touch_walk_guides before update on public.walk_guides
  for each row execute function public.touch_updated_at();

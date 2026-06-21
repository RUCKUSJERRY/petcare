-- walk_goals : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_walk_goals on public.walk_goals;
create trigger trg_touch_walk_goals before update on public.walk_goals
  for each row execute function public.touch_updated_at();

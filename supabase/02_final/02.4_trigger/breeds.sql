-- breeds : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_breeds on public.breeds;
create trigger trg_touch_breeds before update on public.breeds
  for each row execute function public.touch_updated_at();

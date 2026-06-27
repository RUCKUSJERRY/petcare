-- food_safety : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_food_safety on public.food_safety;
create trigger trg_touch_food_safety before update on public.food_safety
  for each row execute function public.touch_updated_at();

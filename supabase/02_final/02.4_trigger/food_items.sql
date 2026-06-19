-- food_items : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_food_items on public.food_items;
create trigger trg_touch_food_items before update on public.food_items
  for each row execute function public.touch_updated_at();

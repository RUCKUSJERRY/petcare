-- breed_food_rules : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_breed_food_rules on public.breed_food_rules;
create trigger trg_touch_breed_food_rules before update on public.breed_food_rules
  for each row execute function public.touch_updated_at();

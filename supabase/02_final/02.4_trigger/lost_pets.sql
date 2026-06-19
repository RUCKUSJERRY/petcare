-- lost_pets : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_lost on public.lost_pets;
create trigger trg_touch_lost before update on public.lost_pets
  for each row execute function public.touch_updated_at();

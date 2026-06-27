-- subscriptions : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_subscriptions on public.subscriptions;
create trigger trg_touch_subscriptions before update on public.subscriptions
  for each row execute function public.touch_updated_at();

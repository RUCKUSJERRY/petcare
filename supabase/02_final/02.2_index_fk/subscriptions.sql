-- subscriptions : 외래키 + 인덱스
alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 갱신 크론이 "결제 예정 도래분"을 빠르게 찾기 위한 인덱스
create index if not exists idx_subscriptions_renew on public.subscriptions (status, current_period_end);

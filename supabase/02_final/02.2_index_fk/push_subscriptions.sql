-- push_subscriptions : 외래키 + 인덱스
alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_fkey;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);
create index if not exists idx_push_sub_updated_at on public.push_subscriptions (updated_at);

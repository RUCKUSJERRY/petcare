-- payments : 외래키 + 인덱스
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_payments_user on public.payments (user_id, created_at desc);

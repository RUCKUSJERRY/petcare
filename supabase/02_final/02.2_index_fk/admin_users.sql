-- admin_users : 외래키 (PK가 user_id라 별도 인덱스 불필요)
alter table public.admin_users drop constraint if exists admin_users_user_id_fkey;
alter table public.admin_users add constraint admin_users_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

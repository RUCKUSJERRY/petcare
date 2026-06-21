-- walk_goals : 외래키 (PK가 user_id라 별도 인덱스 불필요)
alter table public.walk_goals drop constraint if exists walk_goals_user_id_fkey;
alter table public.walk_goals add constraint walk_goals_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

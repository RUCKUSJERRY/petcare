-- walk_likes : 외래키
alter table public.walk_likes drop constraint if exists walk_likes_walk_id_fkey;
alter table public.walk_likes add constraint walk_likes_walk_id_fkey
  foreign key (walk_id) references public.walks(id) on delete cascade;
alter table public.walk_likes drop constraint if exists walk_likes_user_id_fkey;
alter table public.walk_likes add constraint walk_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

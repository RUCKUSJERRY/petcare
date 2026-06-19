-- post_likes : 외래키
alter table public.post_likes drop constraint if exists post_likes_post_id_fkey;
alter table public.post_likes add constraint post_likes_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.post_likes drop constraint if exists post_likes_user_id_fkey;
alter table public.post_likes add constraint post_likes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

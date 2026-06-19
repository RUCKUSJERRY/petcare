-- posts : 외래키 + 인덱스
alter table public.posts drop constraint if exists posts_user_id_fkey;
alter table public.posts add constraint posts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.posts drop constraint if exists posts_breed_id_fkey;
alter table public.posts add constraint posts_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete set null;

create index if not exists idx_posts_created  on public.posts (created_at desc);
create index if not exists idx_posts_category on public.posts (category, created_at desc);

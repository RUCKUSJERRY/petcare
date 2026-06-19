-- walk_comments : 외래키 + 인덱스
alter table public.walk_comments drop constraint if exists walk_comments_walk_id_fkey;
alter table public.walk_comments add constraint walk_comments_walk_id_fkey
  foreign key (walk_id) references public.walks(id) on delete cascade;
alter table public.walk_comments drop constraint if exists walk_comments_user_id_fkey;
alter table public.walk_comments add constraint walk_comments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_walk_comments on public.walk_comments (walk_id, created_at);

-- comments : 외래키 + 인덱스 (parent_id 자기참조는 테이블 정의에 포함)
alter table public.comments drop constraint if exists comments_post_id_fkey;
alter table public.comments add constraint comments_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.comments drop constraint if exists comments_user_id_fkey;
alter table public.comments add constraint comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_comments_post   on public.comments (post_id, created_at);
create index if not exists idx_comments_parent on public.comments (parent_id, created_at);

-- notifications : 외래키 + 인덱스
alter table public.notifications drop constraint if exists notifications_recipient_id_fkey;
alter table public.notifications add constraint notifications_recipient_id_fkey
  foreign key (recipient_id) references public.profiles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_actor_id_fkey;
alter table public.notifications add constraint notifications_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_post_id_fkey;
alter table public.notifications add constraint notifications_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_comment_id_fkey;
alter table public.notifications add constraint notifications_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

create index if not exists idx_notif_recipient on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notif_unread on public.notifications (recipient_id) where read = false;

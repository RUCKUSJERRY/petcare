-- ============================================================
--  010: 커뮤니티 알림 (댓글 / 좋아요)
--  내 게시글에 댓글이 달리거나 좋아요가 눌리면 알림 생성.
--  본인 행동은 알림 제외. 좋아요 취소 시 해당 알림 제거.
--  Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in ('comment', 'like')),
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notif_recipient on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notif_unread on public.notifications (recipient_id) where read = false;

alter table public.notifications enable row level security;

-- 수신자 본인만 조회/수정(읽음)/삭제. insert는 트리거(security definer)로만.
drop policy if exists "notif_select_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select
  using (auth.uid() = recipient_id);
create policy "notif_update_own" on public.notifications for update
  using (auth.uid() = recipient_id);
create policy "notif_delete_own" on public.notifications for delete
  using (auth.uid() = recipient_id);

-- ───────────────────────────────────────────────
-- 댓글 작성 시 게시글 작성자에게 알림
-- ───────────────────────────────────────────────
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id from public.posts where id = new.post_id;
  if author_id is not null and author_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
    values (author_id, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ───────────────────────────────────────────────
-- 좋아요 시 게시글 작성자에게 알림 / 취소 시 알림 제거
-- ───────────────────────────────────────────────
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id from public.posts where id = new.post_id;
  if author_id is not null and author_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (author_id, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$;

create or replace function public.remove_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'like' and post_id = old.post_id and actor_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists trg_notify_like_ins on public.post_likes;
drop trigger if exists trg_notify_like_del on public.post_likes;
create trigger trg_notify_like_ins after insert on public.post_likes
  for each row execute function public.notify_on_like();
create trigger trg_notify_like_del after delete on public.post_likes
  for each row execute function public.remove_like_notification();

-- ───────────────────────────────────────────────
-- 표시용 뷰: actor 프로필 + 게시글 제목 조인
-- security_invoker로 호출자 RLS(수신자 본인만) 적용
-- ───────────────────────────────────────────────
create or replace view public.notification_list
with (security_invoker = on) as
select
  n.*,
  pr.display_name as actor_name,
  pr.avatar_url   as actor_avatar,
  p.title         as post_title
from public.notifications n
left join public.profiles pr on pr.id = n.actor_id
left join public.posts    p  on p.id = n.post_id;

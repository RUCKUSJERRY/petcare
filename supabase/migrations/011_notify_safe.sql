-- ============================================================
--  011: 알림 트리거를 예외 안전하게 (댓글/좋아요 저장을 막지 않도록)
--  알림 생성이 어떤 이유로 실패해도 원본 댓글/좋아요는 정상 저장.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  begin
    select user_id into author_id from public.posts where id = new.post_id;
    if author_id is not null and author_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (author_id, new.user_id, 'comment', new.post_id, new.id);
    end if;
  exception when others then
    -- 알림 실패는 무시 (댓글 저장은 유지)
    null;
  end;
  return new;
end;
$$;

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  begin
    select user_id into author_id from public.posts where id = new.post_id;
    if author_id is not null and author_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (author_id, new.user_id, 'like', new.post_id);
    end if;
  exception when others then
    null;
  end;
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
  begin
    delete from public.notifications
    where type = 'like' and post_id = old.post_id and actor_id = old.user_id;
  exception when others then
    null;
  end;
  return old;
end;
$$;

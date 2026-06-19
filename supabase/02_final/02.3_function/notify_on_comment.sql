-- notify_on_comment : 댓글/답글 작성 시 알림 생성 (예외 안전, 답글이면 reply)
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  notif_type text;
begin
  begin
    if new.parent_id is not null then
      -- 답글 → 부모 댓글 작성자에게
      select user_id into target_id from public.comments where id = new.parent_id;
      notif_type := 'reply';
    else
      -- 최상위 댓글 → 글 작성자에게
      select user_id into target_id from public.posts where id = new.post_id;
      notif_type := 'comment';
    end if;

    if target_id is not null and target_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (target_id, new.user_id, notif_type, new.post_id, new.id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

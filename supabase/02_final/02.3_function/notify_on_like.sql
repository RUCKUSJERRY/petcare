-- notify_on_like : 좋아요 시 게시글 작성자에게 알림 (예외 안전)
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

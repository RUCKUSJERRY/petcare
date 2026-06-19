-- remove_like_notification : 좋아요 취소 시 해당 알림 제거 (예외 안전)
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

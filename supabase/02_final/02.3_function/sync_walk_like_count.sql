-- sync_walk_like_count : 산책 기록 좋아요 수 자동 동기화
create or replace function public.sync_walk_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.walks set like_count = like_count + 1 where id = new.walk_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.walks set like_count = greatest(like_count - 1, 0) where id = old.walk_id;
    return old;
  end if;
  return null;
end;
$$;

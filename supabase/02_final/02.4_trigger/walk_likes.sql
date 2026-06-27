-- walk_likes : 산책 좋아요 수 동기화 트리거
drop trigger if exists trg_walk_like_ins on public.walk_likes;
drop trigger if exists trg_walk_like_del on public.walk_likes;
create trigger trg_walk_like_ins after insert on public.walk_likes
  for each row execute function public.sync_walk_like_count();
create trigger trg_walk_like_del after delete on public.walk_likes
  for each row execute function public.sync_walk_like_count();

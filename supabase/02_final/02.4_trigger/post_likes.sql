-- post_likes : 좋아요 수 동기화 + 알림 생성/제거 트리거
drop trigger if exists trg_like_count_ins on public.post_likes;
drop trigger if exists trg_like_count_del on public.post_likes;
create trigger trg_like_count_ins after insert on public.post_likes
  for each row execute function public.sync_like_count();
create trigger trg_like_count_del after delete on public.post_likes
  for each row execute function public.sync_like_count();

drop trigger if exists trg_notify_like_ins on public.post_likes;
drop trigger if exists trg_notify_like_del on public.post_likes;
create trigger trg_notify_like_ins after insert on public.post_likes
  for each row execute function public.notify_on_like();
create trigger trg_notify_like_del after delete on public.post_likes
  for each row execute function public.remove_like_notification();

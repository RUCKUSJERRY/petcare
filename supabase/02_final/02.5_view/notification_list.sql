-- notification_list : 알림 목록 뷰 (actor 프로필 + 게시글 제목, security_invoker)
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

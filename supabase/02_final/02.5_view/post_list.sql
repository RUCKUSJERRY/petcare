-- post_list : 게시글 목록 뷰 (작성자/견종/댓글 수 조인)
create or replace view public.post_list as
select
  p.*,
  pr.display_name as author_name,
  pr.avatar_url   as author_avatar,
  b.name_ko       as breed_name,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id
left join public.breeds   b  on b.id = p.breed_id;

-- post_likes : 게시글 좋아요 (중복 방지)
create table if not exists public.post_likes (
  post_id     uuid not null,
  user_id     uuid not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

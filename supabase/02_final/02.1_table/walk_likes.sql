-- walk_likes : 산책 기록 좋아요 (중복 방지)
create table if not exists public.walk_likes (
  walk_id    uuid not null,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (walk_id, user_id)
);

-- walk_comments : 산책 기록 댓글
create table if not exists public.walk_comments (
  id         uuid primary key default gen_random_uuid(),
  walk_id    uuid not null,
  user_id    uuid not null,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

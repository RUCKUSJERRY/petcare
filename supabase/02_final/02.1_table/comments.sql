-- comments : 게시글 댓글 (대댓글 1단계 + 수정 시각 포함)
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null,
  user_id     uuid not null,
  content     text not null check (char_length(content) between 1 and 1000),
  parent_id   uuid references public.comments(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- posts : 커뮤니티 게시글
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  category    text not null check (category in ('질문','자랑','정보공유','일상')),
  title       text not null check (char_length(title) between 1 and 100),
  content     text not null check (char_length(content) between 1 and 5000),
  breed_id    uuid,
  image_url   text,
  image_urls  text[],
  like_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

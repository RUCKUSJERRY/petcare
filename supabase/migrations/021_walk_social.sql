-- ============================================================
--  021: 산책 공유를 커뮤니티 게시판처럼 — 좋아요 + 댓글
--  공유(is_public)된 산책 경로에 다른 사용자가 좋아요·댓글을 남길 수 있다.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

-- 좋아요 수 집계 컬럼
alter table public.walks
  add column if not exists like_count int not null default 0;

-- ───────────────────────────────────────────────
-- 1. walk_likes : 좋아요 (중복 방지)
-- ───────────────────────────────────────────────
create table if not exists public.walk_likes (
  walk_id    uuid not null references public.walks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (walk_id, user_id)
);

alter table public.walk_likes enable row level security;
drop policy if exists "walk_likes_select"     on public.walk_likes;
drop policy if exists "walk_likes_insert_own" on public.walk_likes;
drop policy if exists "walk_likes_delete_own" on public.walk_likes;
-- 공유됐거나 본인 산책에 대해서만 조회/생성 가능
create policy "walk_likes_select" on public.walk_likes for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_insert_own" on public.walk_likes for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_delete_own" on public.walk_likes for delete
  using (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- 2. walk_comments : 댓글
-- ───────────────────────────────────────────────
create table if not exists public.walk_comments (
  id         uuid primary key default gen_random_uuid(),
  walk_id    uuid not null references public.walks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_walk_comments on public.walk_comments (walk_id, created_at);

alter table public.walk_comments enable row level security;
drop policy if exists "walk_comments_select"     on public.walk_comments;
drop policy if exists "walk_comments_insert_own" on public.walk_comments;
drop policy if exists "walk_comments_delete_own" on public.walk_comments;
create policy "walk_comments_select" on public.walk_comments for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_insert_own" on public.walk_comments for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_delete_own" on public.walk_comments for delete
  using (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- 3. 좋아요 수 자동 동기화 트리거
-- ───────────────────────────────────────────────
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

drop trigger if exists trg_walk_like_ins on public.walk_likes;
drop trigger if exists trg_walk_like_del on public.walk_likes;
create trigger trg_walk_like_ins after insert on public.walk_likes
  for each row execute function public.sync_walk_like_count();
create trigger trg_walk_like_del after delete on public.walk_likes
  for each row execute function public.sync_walk_like_count();

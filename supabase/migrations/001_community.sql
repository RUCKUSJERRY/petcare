-- ============================================================
--  펫케어 커뮤니티 기능 마이그레이션
--  Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 실행하세요.
--  (idempotent: 재실행해도 안전하도록 작성)
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. profiles : 사용자 표시 정보
-- ───────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read_profiles"  on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;
create policy "read_profiles"       on public.profiles for select using (true);
create policy "update_own_profile"  on public.profiles for update using (auth.uid() = id);

-- 신규 가입 시 profiles 자동 생성 (Google 메타데이터 활용)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      '익명의 보호자'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 기존 사용자 백필 (이미 가입한 유저용)
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '익명의 보호자'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;


-- ───────────────────────────────────────────────
-- 2. posts : 게시글
-- ───────────────────────────────────────────────
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null check (category in ('질문','자랑','정보공유','일상')),
  title       text not null check (char_length(title) between 1 and 100),
  content     text not null check (char_length(content) between 1 and 5000),
  breed_id    uuid references public.breeds(id) on delete set null,
  image_url   text,
  like_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_posts_created  on public.posts (created_at desc);
create index if not exists idx_posts_category on public.posts (category, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "read_posts"        on public.posts;
drop policy if exists "insert_own_post"   on public.posts;
drop policy if exists "update_own_post"   on public.posts;
drop policy if exists "delete_own_post"   on public.posts;
create policy "read_posts"      on public.posts for select using (true);
create policy "insert_own_post" on public.posts for insert with check (auth.uid() = user_id);
create policy "update_own_post" on public.posts for update using (auth.uid() = user_id);
create policy "delete_own_post" on public.posts for delete using (auth.uid() = user_id);


-- ───────────────────────────────────────────────
-- 3. comments : 댓글
-- ───────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists idx_comments_post on public.comments (post_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "read_comments"        on public.comments;
drop policy if exists "insert_own_comment"   on public.comments;
drop policy if exists "delete_own_comment"   on public.comments;
create policy "read_comments"      on public.comments for select using (true);
create policy "insert_own_comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "delete_own_comment" on public.comments for delete using (auth.uid() = user_id);


-- ───────────────────────────────────────────────
-- 4. post_likes : 좋아요 (중복 방지)
-- ───────────────────────────────────────────────
create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "read_likes"       on public.post_likes;
drop policy if exists "insert_own_like"  on public.post_likes;
drop policy if exists "delete_own_like"  on public.post_likes;
create policy "read_likes"      on public.post_likes for select using (true);
create policy "insert_own_like" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "delete_own_like" on public.post_likes for delete using (auth.uid() = user_id);

-- 좋아요 수 자동 동기화 트리거
create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_like_count_ins on public.post_likes;
drop trigger if exists trg_like_count_del on public.post_likes;
create trigger trg_like_count_ins after insert on public.post_likes
  for each row execute function public.sync_like_count();
create trigger trg_like_count_del after delete on public.post_likes
  for each row execute function public.sync_like_count();


-- ───────────────────────────────────────────────
-- 5. comment_count 집계용 뷰 (목록에서 댓글 수 표시)
-- ───────────────────────────────────────────────
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

-- AI 케어 도우미 대화 저장(스레드/메시지) 테이블 추가. 모두 idempotent.

-- 1) 테이블
create table if not exists public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  user_id     uuid not null,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- 2) FK + 인덱스
alter table public.chat_threads drop constraint if exists chat_threads_user_id_fkey;
alter table public.chat_threads add constraint chat_threads_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
create index if not exists idx_chat_threads_user_updated on public.chat_threads (user_id, updated_at desc);

alter table public.chat_messages drop constraint if exists chat_messages_thread_id_fkey;
alter table public.chat_messages add constraint chat_messages_thread_id_fkey
  foreign key (thread_id) references public.chat_threads(id) on delete cascade;
alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
alter table public.chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
create index if not exists idx_chat_messages_thread_at on public.chat_messages (thread_id, created_at);

-- 3) RLS (본인 대화만)
alter table public.chat_threads enable row level security;
drop policy if exists "chat_threads_select_own" on public.chat_threads;
drop policy if exists "chat_threads_insert_own" on public.chat_threads;
drop policy if exists "chat_threads_update_own" on public.chat_threads;
drop policy if exists "chat_threads_delete_own" on public.chat_threads;
create policy "chat_threads_select_own" on public.chat_threads for select using (auth.uid() = user_id);
create policy "chat_threads_insert_own" on public.chat_threads for insert with check (auth.uid() = user_id);
create policy "chat_threads_update_own" on public.chat_threads for update using (auth.uid() = user_id);
create policy "chat_threads_delete_own" on public.chat_threads for delete using (auth.uid() = user_id);

alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_messages_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);

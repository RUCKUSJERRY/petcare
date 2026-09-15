-- chat_messages : AI 케어 도우미 대화 메시지
-- user_id 는 RLS 단순화를 위한 비정규화(스레드 소유자와 동일)
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  user_id     uuid not null,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

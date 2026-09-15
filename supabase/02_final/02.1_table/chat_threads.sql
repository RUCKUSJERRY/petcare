-- chat_threads : AI 케어 도우미 대화 스레드(대화방)
create table if not exists public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text,                       -- 첫 사용자 메시지에서 생성(없으면 null)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

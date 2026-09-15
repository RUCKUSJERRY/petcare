-- chat_messages : FK + 인덱스
alter table public.chat_messages drop constraint if exists chat_messages_thread_id_fkey;
alter table public.chat_messages add constraint chat_messages_thread_id_fkey
  foreign key (thread_id) references public.chat_threads(id) on delete cascade;
alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
alter table public.chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
create index if not exists idx_chat_messages_thread_at on public.chat_messages (thread_id, created_at);

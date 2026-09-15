-- chat_threads : FK + 인덱스
alter table public.chat_threads drop constraint if exists chat_threads_user_id_fkey;
alter table public.chat_threads add constraint chat_threads_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
create index if not exists idx_chat_threads_user_updated on public.chat_threads (user_id, updated_at desc);

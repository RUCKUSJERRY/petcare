-- chat_threads : RLS (본인 대화만 조회/생성/수정/삭제)
alter table public.chat_threads enable row level security;
drop policy if exists "chat_threads_select_own" on public.chat_threads;
drop policy if exists "chat_threads_insert_own" on public.chat_threads;
drop policy if exists "chat_threads_update_own" on public.chat_threads;
drop policy if exists "chat_threads_delete_own" on public.chat_threads;
create policy "chat_threads_select_own" on public.chat_threads for select using (auth.uid() = user_id);
create policy "chat_threads_insert_own" on public.chat_threads for insert with check (auth.uid() = user_id);
create policy "chat_threads_update_own" on public.chat_threads for update using (auth.uid() = user_id);
create policy "chat_threads_delete_own" on public.chat_threads for delete using (auth.uid() = user_id);

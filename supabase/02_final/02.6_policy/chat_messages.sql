-- chat_messages : RLS (본인 대화만 조회/생성/삭제)
alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_messages_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);

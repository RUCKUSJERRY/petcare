-- notifications : RLS (수신자 본인만 조회/수정/삭제, insert는 트리거로만)
alter table public.notifications enable row level security;
drop policy if exists "notif_select_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select
  using (auth.uid() = recipient_id);
create policy "notif_update_own" on public.notifications for update
  using (auth.uid() = recipient_id);
create policy "notif_delete_own" on public.notifications for delete
  using (auth.uid() = recipient_id);

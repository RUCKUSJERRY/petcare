-- weight_logs : RLS (반려동물 구성원만 접근)
alter table public.weight_logs enable row level security;
drop policy if exists "weight_owner_select" on public.weight_logs;
drop policy if exists "weight_owner_insert" on public.weight_logs;
drop policy if exists "weight_owner_update" on public.weight_logs;
drop policy if exists "weight_owner_delete" on public.weight_logs;
create policy "weight_owner_select" on public.weight_logs for select using (public.is_pet_member(pet_id));
create policy "weight_owner_insert" on public.weight_logs for insert with check (public.is_pet_member(pet_id));
create policy "weight_owner_update" on public.weight_logs for update using (public.is_pet_member(pet_id));
create policy "weight_owner_delete" on public.weight_logs for delete using (public.is_pet_member(pet_id));

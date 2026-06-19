-- records : RLS (반려동물 구성원만 접근)
alter table public.records enable row level security;
drop policy if exists "records_member_select" on public.records;
drop policy if exists "records_member_insert" on public.records;
drop policy if exists "records_member_update" on public.records;
drop policy if exists "records_member_delete" on public.records;
create policy "records_member_select" on public.records for select using (public.is_pet_member(pet_id));
create policy "records_member_insert" on public.records for insert with check (public.is_pet_member(pet_id));
create policy "records_member_update" on public.records for update using (public.is_pet_member(pet_id));
create policy "records_member_delete" on public.records for delete using (public.is_pet_member(pet_id));

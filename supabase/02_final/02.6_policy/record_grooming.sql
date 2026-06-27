-- record_grooming : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_grooming enable row level security;
drop policy if exists "record_grooming_select" on public.record_grooming;
drop policy if exists "record_grooming_insert" on public.record_grooming;
drop policy if exists "record_grooming_update" on public.record_grooming;
drop policy if exists "record_grooming_delete" on public.record_grooming;
create policy "record_grooming_select" on public.record_grooming for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_insert" on public.record_grooming for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_update" on public.record_grooming for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_delete" on public.record_grooming for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

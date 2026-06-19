-- record_medical : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_medical enable row level security;
drop policy if exists "record_medical_select" on public.record_medical;
drop policy if exists "record_medical_insert" on public.record_medical;
drop policy if exists "record_medical_update" on public.record_medical;
drop policy if exists "record_medical_delete" on public.record_medical;
create policy "record_medical_select" on public.record_medical for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_insert" on public.record_medical for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_update" on public.record_medical for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_delete" on public.record_medical for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

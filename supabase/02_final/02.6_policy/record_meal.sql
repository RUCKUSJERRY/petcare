-- record_meal : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_meal enable row level security;
drop policy if exists "record_meal_select" on public.record_meal;
drop policy if exists "record_meal_insert" on public.record_meal;
drop policy if exists "record_meal_update" on public.record_meal;
drop policy if exists "record_meal_delete" on public.record_meal;
create policy "record_meal_select" on public.record_meal for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_insert" on public.record_meal for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_update" on public.record_meal for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_delete" on public.record_meal for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

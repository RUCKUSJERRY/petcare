-- pet_members : RLS (구성원끼리 조회, owner만 추가, owner/본인 삭제)
alter table public.pet_members enable row level security;
drop policy if exists "pet_members_select" on public.pet_members;
drop policy if exists "pet_members_insert" on public.pet_members;
drop policy if exists "pet_members_delete" on public.pet_members;
create policy "pet_members_select" on public.pet_members for select
  using (public.is_pet_member(pet_id));
create policy "pet_members_insert" on public.pet_members for insert
  with check (public.is_pet_owner(pet_id));
create policy "pet_members_delete" on public.pet_members for delete
  using (public.is_pet_owner(pet_id) or user_id = auth.uid());

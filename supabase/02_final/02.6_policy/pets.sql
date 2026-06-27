-- pets : RLS (멤버십 기반 조회/수정, owner만 삭제, 본인 명의 등록)
alter table public.pets enable row level security;
drop policy if exists "pets_member_select" on public.pets;
drop policy if exists "pets_insert_own"   on public.pets;
drop policy if exists "pets_member_update" on public.pets;
drop policy if exists "pets_owner_delete"  on public.pets;
create policy "pets_member_select" on public.pets for select
  using (public.is_pet_member(id) or user_id = auth.uid());
create policy "pets_insert_own" on public.pets for insert
  with check (auth.uid() = user_id);
create policy "pets_member_update" on public.pets for update
  using (public.is_pet_member(id));
create policy "pets_owner_delete" on public.pets for delete
  using (public.is_pet_owner(id) or user_id = auth.uid());

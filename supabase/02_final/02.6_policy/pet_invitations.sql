-- pet_invitations : RLS (owner만 조회/생성/수정/삭제)
alter table public.pet_invitations enable row level security;
drop policy if exists "pet_inv_select" on public.pet_invitations;
drop policy if exists "pet_inv_insert" on public.pet_invitations;
drop policy if exists "pet_inv_update" on public.pet_invitations;
drop policy if exists "pet_inv_delete" on public.pet_invitations;
create policy "pet_inv_select" on public.pet_invitations for select using (public.is_pet_owner(pet_id));
create policy "pet_inv_insert" on public.pet_invitations for insert
  with check (public.is_pet_owner(pet_id) and invited_by = auth.uid());
create policy "pet_inv_update" on public.pet_invitations for update using (public.is_pet_owner(pet_id));
create policy "pet_inv_delete" on public.pet_invitations for delete using (public.is_pet_owner(pet_id));

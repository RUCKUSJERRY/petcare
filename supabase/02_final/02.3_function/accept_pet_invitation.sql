-- accept_pet_invitation : 초대 수락 → 구성원으로 등록
create or replace function public.accept_pet_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pet uuid; v_status text; v_exp timestamptz;
begin
  select pet_id, status, expires_at into v_pet, v_status, v_exp
  from public.pet_invitations where token = p_token;
  if v_pet is null then raise exception 'invalid_invitation'; end if;
  if v_status <> 'pending' then raise exception 'not_pending'; end if;
  if v_exp < now() then raise exception 'expired'; end if;
  insert into public.pet_members (pet_id, user_id, role)
    values (v_pet, auth.uid(), 'member')
    on conflict (pet_id, user_id) do nothing;
  update public.pet_invitations set status = 'accepted' where token = p_token;
  return v_pet;
end;
$$;

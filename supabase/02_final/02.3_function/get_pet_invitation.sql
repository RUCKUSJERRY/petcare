-- get_pet_invitation : 토큰으로 초대 정보 조회 (RLS 우회)
create or replace function public.get_pet_invitation(p_token uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'pet_id', inv.pet_id,
    'pet_name', p.name,
    'status', inv.status,
    'expired', (inv.expires_at < now()),
    'inviter', pr.display_name
  )
  from public.pet_invitations inv
  left join public.pets p on p.id = inv.pet_id
  left join public.profiles pr on pr.id = inv.invited_by
  where inv.token = p_token;
$$;

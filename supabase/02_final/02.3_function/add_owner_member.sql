-- add_owner_member : 반려동물 등록 시 등록자를 owner 구성원으로 추가
create or replace function public.add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pet_members (pet_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (pet_id, user_id) do nothing;
  return new;
end;
$$;

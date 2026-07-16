-- transfer_pet_ownership : 반려동물 소유권 이전 (임보→입양 등)
-- 현재 owner 만 호출 가능하고, 넘길 대상은 이미 이 아이의 구성원(공동관리 초대 수락)이어야 한다.
-- pet_members 역할을 교체하고 pets.user_id(명의)를 새 주인으로 갱신한다(임보→소유 전환).
create or replace function public.transfer_pet_ownership(p_pet_id uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'not_owner';
  end if;
  if p_new_owner = auth.uid() then
    raise exception 'same_owner';
  end if;
  if not exists (
    select 1 from public.pet_members
    where pet_id = p_pet_id and user_id = p_new_owner
  ) then
    raise exception 'not_member';
  end if;
  update public.pet_members set role = 'owner'  where pet_id = p_pet_id and user_id = p_new_owner;
  update public.pet_members set role = 'member' where pet_id = p_pet_id and user_id = auth.uid();
  update public.pets set user_id = p_new_owner, care_type = 'own' where id = p_pet_id;
end;
$$;

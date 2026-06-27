-- is_pet_owner : 현재 사용자가 해당 반려동물 owner인지 (RLS 헬퍼)
create or replace function public.is_pet_owner(p_pet_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pet_members m
    where m.pet_id = p_pet_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

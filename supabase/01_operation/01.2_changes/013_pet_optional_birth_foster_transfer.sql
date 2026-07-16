-- 013: 반려동물 등록 유연화(생년 선택) + 임시보호 플래그 + 소유권 이전
--  (A) 임보/구조 등 정확한 생년월을 모르는 경우를 허용 — birth_year/birth_month 선택값화
--  (B) 임시보호(foster) 표시 + 입양 시 소유권 이전 함수
-- 모두 idempotent(재실행 안전).

-- (A) 생년월 선택값화 ---------------------------------------------------------
-- 나이 미상 반려동물(구조·임보)도 등록할 수 있게 한다. (birth_month CHECK 는 NULL 을 통과하므로 유지)
alter table public.pets alter column birth_year  drop not null;
alter table public.pets alter column birth_month drop not null;

-- (B) 임시보호 여부 플래그 ----------------------------------------------------
alter table public.pets add column if not exists care_type text not null default 'own';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_care_type_check') then
    alter table public.pets add constraint pets_care_type_check
      check (care_type in ('own', 'foster'));
  end if;
end $$;

-- (B) 소유권 이전 함수 --------------------------------------------------------
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

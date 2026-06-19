-- pets : 등록 시 등록자를 owner 구성원으로 자동 추가하는 트리거
drop trigger if exists trg_pet_owner_member on public.pets;
create trigger trg_pet_owner_member after insert on public.pets
  for each row execute function public.add_owner_member();

-- pet_members : 외래키 + 인덱스
alter table public.pet_members drop constraint if exists pet_members_pet_id_fkey;
alter table public.pet_members add constraint pet_members_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.pet_members drop constraint if exists pet_members_user_id_fkey;
alter table public.pet_members add constraint pet_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_pet_members_user on public.pet_members (user_id);

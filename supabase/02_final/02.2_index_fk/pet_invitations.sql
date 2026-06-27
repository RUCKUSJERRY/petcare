-- pet_invitations : 외래키 + 인덱스
alter table public.pet_invitations drop constraint if exists pet_invitations_pet_id_fkey;
alter table public.pet_invitations add constraint pet_invitations_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.pet_invitations drop constraint if exists pet_invitations_invited_by_fkey;
alter table public.pet_invitations add constraint pet_invitations_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete cascade;

create index if not exists idx_pet_inv_pet on public.pet_invitations (pet_id);

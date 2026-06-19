-- lost_pet_sightings : 외래키 + 인덱스
alter table public.lost_pet_sightings drop constraint if exists lost_pet_sightings_lost_pet_id_fkey;
alter table public.lost_pet_sightings add constraint lost_pet_sightings_lost_pet_id_fkey
  foreign key (lost_pet_id) references public.lost_pets(id) on delete cascade;
alter table public.lost_pet_sightings drop constraint if exists lost_pet_sightings_user_id_fkey;
alter table public.lost_pet_sightings add constraint lost_pet_sightings_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_sighting_lost on public.lost_pet_sightings (lost_pet_id, created_at);

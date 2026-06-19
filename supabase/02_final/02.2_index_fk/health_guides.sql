-- health_guides : 외래키 + 인덱스
alter table public.health_guides drop constraint if exists health_guides_breed_id_fkey;
alter table public.health_guides add constraint health_guides_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;

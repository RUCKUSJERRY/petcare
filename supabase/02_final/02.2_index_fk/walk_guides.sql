-- walk_guides : 외래키 + 인덱스
alter table public.walk_guides drop constraint if exists walk_guides_breed_id_fkey;
alter table public.walk_guides add constraint walk_guides_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;

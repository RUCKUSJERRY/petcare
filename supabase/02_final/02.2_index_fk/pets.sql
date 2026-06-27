-- pets : 외래키 + 인덱스
alter table public.pets drop constraint if exists pets_user_id_fkey;
alter table public.pets add constraint pets_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.pets drop constraint if exists pets_breed_id_fkey;
alter table public.pets add constraint pets_breed_id_fkey
  foreign key (breed_id) references public.breeds(id);

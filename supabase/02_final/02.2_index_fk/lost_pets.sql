-- lost_pets : 외래키 + 인덱스
alter table public.lost_pets drop constraint if exists lost_pets_user_id_fkey;
alter table public.lost_pets add constraint lost_pets_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.lost_pets drop constraint if exists lost_pets_breed_id_fkey;
alter table public.lost_pets add constraint lost_pets_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete set null;

create index if not exists idx_lost_status_created on public.lost_pets (status, created_at desc);

-- map_favorites : 외래키 + 인덱스
alter table public.map_favorites drop constraint if exists map_favorites_user_id_fkey;
alter table public.map_favorites add constraint map_favorites_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_map_fav_user on public.map_favorites (user_id, created_at desc);

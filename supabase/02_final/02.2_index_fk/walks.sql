-- walks : 외래키 + 인덱스
alter table public.walks drop constraint if exists walks_user_id_fkey;
alter table public.walks add constraint walks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.walks drop constraint if exists walks_pet_id_fkey;
alter table public.walks add constraint walks_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete set null;

create index if not exists idx_walks_user on public.walks (user_id, started_at desc);
create index if not exists idx_walks_public on public.walks (created_at desc) where is_public;

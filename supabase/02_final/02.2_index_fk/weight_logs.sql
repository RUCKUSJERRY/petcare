-- weight_logs : 외래키 + 인덱스
alter table public.weight_logs drop constraint if exists weight_logs_pet_id_fkey;
alter table public.weight_logs add constraint weight_logs_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;

create index if not exists idx_weight_logs_pet on public.weight_logs (pet_id, measured_on);

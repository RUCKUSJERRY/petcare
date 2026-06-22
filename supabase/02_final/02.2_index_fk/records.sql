-- records : 외래키 + 인덱스
alter table public.records drop constraint if exists records_pet_id_fkey;
alter table public.records add constraint records_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;

create index if not exists idx_records_pet_event on public.records (pet_id, event_on desc);
create index if not exists idx_records_pet_due   on public.records (pet_id, next_due_on);
create index if not exists idx_records_pet_event_at on public.records (pet_id, event_at desc);

-- record_grooming : 외래키 (records 1:1)
alter table public.record_grooming drop constraint if exists record_grooming_record_id_fkey;
alter table public.record_grooming add constraint record_grooming_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

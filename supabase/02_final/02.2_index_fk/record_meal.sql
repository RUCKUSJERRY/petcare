-- record_meal : 외래키 (records 1:1)
alter table public.record_meal drop constraint if exists record_meal_record_id_fkey;
alter table public.record_meal add constraint record_meal_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

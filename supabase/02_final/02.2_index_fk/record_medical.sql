-- record_medical : 외래키 (records 1:1)
alter table public.record_medical drop constraint if exists record_medical_record_id_fkey;
alter table public.record_medical add constraint record_medical_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

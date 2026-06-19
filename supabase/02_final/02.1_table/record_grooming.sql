-- record_grooming : records 미용 상세 (1:1)
create table if not exists public.record_grooming (
  record_id   uuid primary key,
  method      text,
  vendor      text,
  groom_type  text
);

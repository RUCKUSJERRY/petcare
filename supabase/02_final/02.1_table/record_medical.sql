-- record_medical : records 진료 상세 (1:1)
create table if not exists public.record_medical (
  record_id   uuid primary key,
  reason      text,
  treatment   text,
  medication  text
);

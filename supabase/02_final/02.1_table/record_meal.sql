-- record_meal : records 식사/간식 상세 (1:1)
create table if not exists public.record_meal (
  record_id   uuid primary key,
  food_kind   text,
  mix         text,
  amount      text
);

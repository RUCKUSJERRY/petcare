-- food_safety : 외래키 + 인덱스
alter table public.food_safety drop constraint if exists food_safety_food_id_fkey;
alter table public.food_safety add constraint food_safety_food_id_fkey
  foreign key (food_id) references public.food_items(id) on delete cascade;

create index if not exists idx_food_safety_food on public.food_safety (food_id);

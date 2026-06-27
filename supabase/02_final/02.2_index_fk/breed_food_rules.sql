-- breed_food_rules : 외래키 + 인덱스
alter table public.breed_food_rules drop constraint if exists breed_food_rules_breed_id_fkey;
alter table public.breed_food_rules add constraint breed_food_rules_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;
alter table public.breed_food_rules drop constraint if exists breed_food_rules_food_id_fkey;
alter table public.breed_food_rules add constraint breed_food_rules_food_id_fkey
  foreign key (food_id) references public.food_items(id) on delete cascade;

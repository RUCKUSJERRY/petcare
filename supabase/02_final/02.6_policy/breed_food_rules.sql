-- breed_food_rules : RLS + 공개 읽기 정책
alter table public.breed_food_rules enable row level security;
drop policy if exists "breed_food_rules 공개 읽기" on public.breed_food_rules;
create policy "breed_food_rules 공개 읽기" on public.breed_food_rules for select using (true);

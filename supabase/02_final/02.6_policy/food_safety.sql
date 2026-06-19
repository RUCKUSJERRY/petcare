-- food_safety : RLS + 공개 읽기 정책
alter table public.food_safety enable row level security;
drop policy if exists "food_safety 공개 읽기" on public.food_safety;
create policy "food_safety 공개 읽기" on public.food_safety for select using (true);

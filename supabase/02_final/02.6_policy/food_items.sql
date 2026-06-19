-- food_items : RLS + 공개 읽기 정책
alter table public.food_items enable row level security;
drop policy if exists "food_items 공개 읽기" on public.food_items;
create policy "food_items 공개 읽기" on public.food_items for select using (true);

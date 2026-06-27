-- lost_pet_sightings : RLS (공개 읽기, 본인만 작성/삭제)
alter table public.lost_pet_sightings enable row level security;
drop policy if exists "sighting_select" on public.lost_pet_sightings;
drop policy if exists "sighting_insert_own" on public.lost_pet_sightings;
drop policy if exists "sighting_delete_own" on public.lost_pet_sightings;
create policy "sighting_select"     on public.lost_pet_sightings for select using (true);
create policy "sighting_insert_own" on public.lost_pet_sightings for insert with check (auth.uid() = user_id);
create policy "sighting_delete_own" on public.lost_pet_sightings for delete using (auth.uid() = user_id);

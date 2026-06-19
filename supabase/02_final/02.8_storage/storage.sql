-- storage : 버킷 생성 + storage.objects 정책 (커뮤니티/아바타/반려동물 사진)

-- 버킷 생성 (public 읽기)
insert into storage.buckets (id, name, public)
values
  ('post-images', 'post-images', true),
  ('avatars',     'avatars',     true),
  ('pet-photos',  'pet-photos',  true)
on conflict (id) do nothing;

-- ── post-images 정책 ──────────────────────────────
drop policy if exists "post_images_read"   on storage.objects;
drop policy if exists "post_images_insert" on storage.objects;
drop policy if exists "post_images_delete" on storage.objects;
create policy "post_images_read" on storage.objects
  for select using (bucket_id = 'post-images');
create policy "post_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "post_images_delete" on storage.objects
  for delete using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── avatars 정책 ──────────────────────────────────
drop policy if exists "avatars_read"   on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── pet-photos 정책 ───────────────────────────────
drop policy if exists "pet_photos_read"   on storage.objects;
drop policy if exists "pet_photos_insert" on storage.objects;
drop policy if exists "pet_photos_update" on storage.objects;
drop policy if exists "pet_photos_delete" on storage.objects;
create policy "pet_photos_read" on storage.objects
  for select using (bucket_id = 'pet-photos');
create policy "pet_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_photos_update" on storage.objects
  for update using (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

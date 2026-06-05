-- ============================================================
--  Storage 버킷 + 정책 (반려동물 프로필 사진)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--  파일 경로 규칙: {user_id}/{파일명}  → 본인 폴더만 쓰기 가능
-- ============================================================

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

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

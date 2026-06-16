-- ============================================================
--  027: 사진 여러 장 지원 (records / posts / lost_pets)
--  기존 단일 컬럼(photo_url / image_url)은 보존하고, 배열 컬럼을 추가한다.
--  앱은 배열에 저장하면서 첫 장을 단일 컬럼에도 함께 기록한다
--  (목록 썸네일·기존 조회 호환). 프로필 사진은 단일 그대로 둔다.
--  ※ 025 실행 후. (idempotent)
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- ============================================================

-- 통합 기록
alter table public.records add column if not exists photo_urls text[];
update public.records
  set photo_urls = array[photo_url]
  where photo_url is not null and (photo_urls is null or cardinality(photo_urls) = 0);

-- 커뮤니티 글
alter table public.posts add column if not exists image_urls text[];
update public.posts
  set image_urls = array[image_url]
  where image_url is not null and (image_urls is null or cardinality(image_urls) = 0);

-- 실종 신고
alter table public.lost_pets add column if not exists photo_urls text[];
update public.lost_pets
  set photo_urls = array[photo_url]
  where photo_url is not null and (photo_urls is null or cardinality(photo_urls) = 0);

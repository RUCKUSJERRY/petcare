-- app_settings : 운영 설정 키-값 저장소 (가격·광고 토글 등). 코드 수정/재배포 없이 변경.
-- 공개 읽기(가격·광고 노출 판단), 쓰기는 관리자만(RLS).
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- 019: 생일·입양 기념일 축하 푸시 설정 (profiles 옵트인 + app_settings 전역 스위치)
-- 오늘(KST)이 생일 또는 입양 기념일(만 1주년 이상)인 아이가 있으면 아침에 축하 푸시를 보낸다.
--
-- [사용자 옵트인] profiles.anniversary_push_enabled — 기본 true(기본 on). 생일 축하는 거부감이
--   적고 리텐션 효과가 커서 기본 켬. 원치 않는 사용자는 설정에서 끌 수 있다.
--   anniversary_push_last_on 은 하루 1회 발송을 보장하는 당일 중복 방지 플래그.
-- [전역 스위치] app_settings.anniversary_push_active — 관리자가 기능 전체를 켜고 끈다(기본 true).
--   off 면 cron 이 아무에게도 보내지 않는다. (ads_enabled 와 동일 패턴)
alter table public.profiles add column if not exists anniversary_push_enabled boolean not null default true;
alter table public.profiles add column if not exists anniversary_push_last_on date;
-- 컬럼이 이미(다른 기본값으로) 있었어도 기본 on 으로 통일 (재실행 안전)
alter table public.profiles alter column anniversary_push_enabled set default true;

-- 전역 기능 스위치 시드 (없을 때만 — 관리자가 바꾼 값은 보존)
insert into public.app_settings (key, value) values ('anniversary_push_active', 'true')
on conflict (key) do nothing;

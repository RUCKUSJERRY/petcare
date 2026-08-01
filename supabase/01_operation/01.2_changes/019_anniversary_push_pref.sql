-- 019: 생일·입양 기념일 축하 푸시 옵트인 설정 (profiles)
-- 오늘(KST)이 생일 또는 입양 기념일(만 1주년 이상)인 아이가 있으면 오전에 축하 푸시를 보낸다.
-- 사용자가 명시적으로 켠 경우에만 발송(기본 false → 기존 사용자 아무도 자동 수신하지 않음).
-- anniversary_push_last_on 은 하루 1회 발송을 보장하는 당일 중복 방지 플래그
-- (streak_push_last_on · tip_push_last_on 과 동일 개념).
alter table public.profiles add column if not exists anniversary_push_enabled boolean not null default false;
alter table public.profiles add column if not exists anniversary_push_last_on date;

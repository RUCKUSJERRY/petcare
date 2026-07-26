-- 016: 연속 기록(streak) 리마인더 푸시 옵트인 설정 (profiles)
-- 저녁까지 오늘 기록이 없고 진행 중인 연속 기록(2일 이상)이 있으면 "끊기기 전에 기록하세요" 알림.
-- 사용자가 명시적으로 켠 경우에만 발송(기본 false → 기존 사용자 아무도 자동 수신하지 않음).
-- streak_push_last_on 은 하루 1회 발송을 보장하는 당일 중복 방지 플래그
-- (tip_push_last_on · care-reminders 의 last_reminded_on 과 동일 개념).
alter table public.profiles add column if not exists streak_push_enabled boolean not null default false;
alter table public.profiles add column if not exists streak_push_last_on date;

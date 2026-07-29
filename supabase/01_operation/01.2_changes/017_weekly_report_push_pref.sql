-- 017: 주간 리포트 푸시 옵트인 설정 (profiles)
-- 주 1회(일요일 저녁) '이번 주 활동 요약'을 푸시로 보내 재방문·리텐션을 유도한다.
-- 사용자가 명시적으로 켠 경우에만 발송(기본 false → 기존 사용자 아무도 자동 수신하지 않음).
-- weekly_report_push_last_on 은 한 주 1회 발송을 보장하는 중복 방지 플래그
-- (streak_push_last_on · tip_push_last_on 과 동일 개념 — 주 단위).
alter table public.profiles add column if not exists weekly_report_push_enabled boolean not null default false;
alter table public.profiles add column if not exists weekly_report_push_last_on date;

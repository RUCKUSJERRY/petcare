-- 생활기록(오늘의 기록) 고도화:
--  - records 에 시각(event_at) 추가 — 하루 여러 번 남기는 생활기록의 시간순 정렬/타임라인용
--    (기존 일정 기록은 event_at NULL 로 두고 event_on(날짜)만 사용 → 영향 없음)
--  - 반려동물 생활기록 카테고리 추가: 소변·대변·물·투약·증상
--  모두 idempotent.

-- 1) 시각 컬럼
alter table public.records add column if not exists event_at timestamptz;

-- 2) 카테고리 CHECK 제약에 생활기록 카테고리 추가 (drop 후 재생성)
alter table public.records drop constraint if exists records_category_check;
alter table public.records add constraint records_category_check check (category in (
  '접종','심장사상충','구충','외부기생충','건강검진','진료',
  '미용','양치','발톱','목욕','귀청소',
  '식사','간식','소변','대변','물','투약','증상',
  '기타'
));

-- 3) 타임라인(특정 날짜의 생활기록 시간순) 조회용 인덱스
create index if not exists idx_records_pet_event_at on public.records (pet_id, event_at desc);

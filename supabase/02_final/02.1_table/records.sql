-- records : 통합 기록 모델 (캘린더형 공통 기록)
create table if not exists public.records (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null,
  category         text not null check (category in (
                     '접종','심장사상충','구충','외부기생충','건강검진','진료',
                     '미용','양치','발톱','목욕','귀청소',
                     '식사','간식','물','배변','투약',
                     -- 레거시(신규 입력 제외, 과거 데이터 호환): 소변·대변→배변, 증상→진료
                     '소변','대변','증상',
                     '기타'
                   )),
  title            text not null,
  event_on         date not null default current_date,
  event_at         timestamptz,                  -- 생활기록 시각(시간순 타임라인용). 일정 기록은 NULL
  place_name       text,
  place_lat        double precision,
  place_lng        double precision,
  cost             integer check (cost is null or cost >= 0),
  memo             text,
  photo_url        text,
  photo_urls       text[],
  recur_rule       text,
  next_due_on      date,
  last_reminded_on date,
  created_at       timestamptz not null default now()
);

-- pets : 사용자의 반려동물
create table if not exists public.pets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  name             text not null,
  breed_id         uuid,
  birth_year       int,                                              -- 선택(나이 미상 허용)
  birth_month      int check (birth_month between 1 and 12),         -- 선택(나이 미상 허용)
  birth_day        smallint check (birth_day is null or birth_day between 1 and 31),
  adopted_on       date,
  gender           text check (gender in ('수컷', '암컷')),
  weight_kg        float check (weight_kg is null or weight_kg > 0),
  photo_url        text,
  species          text not null default 'dog' check (species in ('dog','cat')),
  target_weight_kg float check (target_weight_kg is null or target_weight_kg > 0),
  care_type        text not null default 'own' check (care_type in ('own','foster')),  -- 'foster'=임시보호
  created_at       timestamptz default now()
);

-- 기존 테이블 보강 (재실행 안전) — birth_day(생일 '일'), adopted_on(입양일)
alter table public.pets add column if not exists birth_day smallint;
alter table public.pets add column if not exists adopted_on date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_birth_day_check') then
    alter table public.pets
      add constraint pets_birth_day_check check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

-- 나이 미상(구조·임보) 허용 — birth_year/birth_month 선택값화 (재실행 안전)
alter table public.pets alter column birth_year  drop not null;
alter table public.pets alter column birth_month drop not null;

-- 임시보호(foster) 여부 (재실행 안전)
alter table public.pets add column if not exists care_type text not null default 'own';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_care_type_check') then
    alter table public.pets add constraint pets_care_type_check check (care_type in ('own','foster'));
  end if;
end $$;

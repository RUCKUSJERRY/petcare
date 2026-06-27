-- pets : 사용자의 반려동물
create table if not exists public.pets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  name             text not null,
  breed_id         uuid,
  birth_year       int not null,
  birth_month      int not null check (birth_month between 1 and 12),
  birth_day        smallint check (birth_day is null or birth_day between 1 and 31),
  adopted_on       date,
  gender           text check (gender in ('수컷', '암컷')),
  weight_kg        float check (weight_kg is null or weight_kg > 0),
  photo_url        text,
  species          text not null default 'dog' check (species in ('dog','cat')),
  target_weight_kg float check (target_weight_kg is null or target_weight_kg > 0),
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

-- pets: 생일 '일(birth_day)' + 입양일(adopted_on) 컬럼 추가 (둘 다 선택값)
-- birth_year/birth_month 만으로는 생일 D-day 를 정확히 계산할 수 없어 일(day)을 추가한다.
-- adopted_on 은 "함께한 지 N일째"·입양 기념일 표시에 사용한다.
alter table public.pets add column if not exists birth_day smallint;
alter table public.pets add column if not exists adopted_on date;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_birth_day_check') then
    alter table public.pets
      add constraint pets_birth_day_check check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

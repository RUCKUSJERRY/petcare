-- pets : 사용자의 반려동물
create table if not exists public.pets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  name             text not null,
  breed_id         uuid,
  birth_year       int not null,
  birth_month      int not null check (birth_month between 1 and 12),
  gender           text check (gender in ('수컷', '암컷')),
  weight_kg        float check (weight_kg is null or weight_kg > 0),
  photo_url        text,
  species          text not null default 'dog' check (species in ('dog','cat')),
  target_weight_kg float check (target_weight_kg is null or target_weight_kg > 0),
  created_at       timestamptz default now()
);

-- lost_pets : 실종 반려동물 제보 (지도 기반)
create table if not exists public.lost_pets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text,
  species        text not null check (species in ('dog', 'cat')),
  breed_id       uuid,
  gender         text check (gender in ('수컷', '암컷')),
  photo_url      text,
  photo_urls     text[],
  lost_at        date not null default current_date,
  lat            double precision not null,
  lng            double precision not null,
  area_text      text,
  description    text,
  contact        text,
  contact_public boolean not null default true,
  status         text not null default 'active' check (status in ('active', 'found')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

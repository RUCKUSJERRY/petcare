-- map_favorites : 지도 즐겨찾기 (동물병원/카페/식당)
create table if not exists public.map_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  place_id    text not null,
  place_name  text not null,
  category    text,
  address     text,
  phone       text,
  lat         double precision not null,
  lng         double precision not null,
  place_url   text,
  created_at  timestamptz not null default now(),
  unique (user_id, place_id)
);

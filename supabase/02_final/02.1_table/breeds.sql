-- breeds : 견종/묘종 마스터 (강아지·고양이 품종 정보)
create table if not exists public.breeds (
  id              uuid primary key default gen_random_uuid(),
  name_ko         text not null,
  name_en         text,
  size_category   text check (size_category in ('소형', '중형', '대형')),
  avg_lifespan    int,
  characteristics text,
  species         text not null default 'dog' check (species in ('dog','cat')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

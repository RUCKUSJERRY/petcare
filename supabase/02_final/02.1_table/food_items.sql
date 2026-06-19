-- food_items : 음식 항목 마스터 (안전도는 food_safety 가 종별로 관리)
create table if not exists public.food_items (
  id         uuid primary key default gen_random_uuid(),
  name_ko    text not null unique,
  category   text check (category in ('육류','채소','과일','유제품','기타')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

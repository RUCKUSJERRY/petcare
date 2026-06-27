-- breed_food_rules : 견종/묘종별 음식 예외 규칙 (override)
create table if not exists public.breed_food_rules (
  id              uuid primary key default gen_random_uuid(),
  breed_id        uuid not null,
  food_id         uuid not null,
  override_safety text not null check (override_safety in ('safe', 'caution', 'dangerous')),
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (breed_id, food_id)
);

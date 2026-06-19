-- weight_logs : 반려동물 체중 기록
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null,
  weight_kg   float not null check (weight_kg > 0),
  measured_on date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

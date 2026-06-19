-- pet_members : 반려동물 공동 관리 구성원
create table if not exists public.pet_members (
  pet_id     uuid not null,
  user_id    uuid not null,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);
